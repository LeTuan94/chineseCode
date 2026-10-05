class LearnChineseApp {
    constructor() {
        this.historyData = [];
        this.currentRenderedText = "";
        this.activeRowElement = null;
        this.speechRate = 1;
        this.isLowSpeed = false;
        this.isRepeating = false;
        this.currentDrawSession = 0;
        this.pendingTranslations = {};
        
        this.charCache = JSON.parse(localStorage.getItem("charCache")) || {};
        this.LOCAL_KEY = 'hsk_history';

        this.dom = {
            title: document.querySelector('.app-title'),
            searchInput: document.querySelector('.input-text'),
            findBtn: document.querySelector('.findBtn'),
            clearBtn: document.querySelector('.clearBtn'),
            excelInput: document.querySelector('.excel-file'),
            speedBtn: document.querySelector('.speed-btn'),
            repeatBtn: document.querySelector('.repeat-btn'),
            hideBtn: document.querySelector('.hide-btn'),
            backBtn: document.querySelector('.back-btn'),
            hskBtns: document.querySelectorAll('.hskBtn'),
            sentenceList: document.querySelector('.sentence-list'),
            animationWrapper: document.querySelector('.animation-wrapper'),
            animationArea: document.querySelector('.animation-area'),
            searchWrapper: document.querySelector('.search-wrapper'),
            sentenceSection: document.querySelector('.sentence-section'),
            backToTop: document.querySelector('.back-to-top'),
            errorMsg: document.querySelector('.error-message'),
            pullLoader: document.querySelector('.pull-loader'),
            
            jumpInput: document.getElementById('jumpInput'),
            jumpBtn: document.getElementById('jumpBtn'),
            hskButtonsContainer: document.querySelector('.hsk-buttons'),
            tableWrapper: document.querySelector('.tableWrapper'),
            hskHint: document.querySelector('.hsk-hint'),
            tableHint: document.querySelector('.table-hint'),

            practiceStart: document.getElementById('practiceStart'),
            practiceEnd: document.getElementById('practiceEnd'),
            practiceBtn: document.getElementById('practiceBtn'),
            practiceModal: document.getElementById('practiceModal'),
            closePracticeBtn: document.getElementById('closePracticeBtn'),
            practiceContainer: document.getElementById('practiceContainer')
        };

        this.init();
    }

    init() {
        this.loadInitialData();
        this.bindEvents();
        this.initPullToRefresh();
        this.initScrollEvents();
        window.addEventListener('load', () => this.checkOverflows());
    }

    bindEvents() {
        this.dom.title.addEventListener('click', () => location.reload());
        this.dom.findBtn.addEventListener('click', () => this.processSearch());
        this.dom.clearBtn.addEventListener('click', () => this.clearAll());
        this.dom.excelInput.addEventListener('change', (e) => this.importExcel(e));
        
        this.dom.speedBtn.addEventListener('click', () => this.toggleSpeed());
        this.dom.repeatBtn.addEventListener('click', () => this.toggleRepeat());
        this.dom.hideBtn.addEventListener('click', () => this.dom.animationWrapper.classList.toggle('show'));
        this.dom.backBtn.addEventListener('click', () => this.scrollToActiveRow());
        this.dom.backToTop.addEventListener('click', () => window.scrollTo({top: 0, behavior: 'smooth'}));

        this.dom.hskBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const level = e.target.getAttribute('data-level');
                this.loadHSK(level);
            });
        });
        
        this.dom.jumpBtn.addEventListener('click', () => this.jumpToRow());
        this.dom.jumpInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.jumpToRow();
        });

        this.dom.practiceBtn.addEventListener('click', () => this.startPractice());
        this.dom.closePracticeBtn.addEventListener('click', () => {
            this.dom.practiceModal.classList.remove('show');
        });
        
        if (this.dom.hskButtonsContainer && this.dom.hskHint) {
            this.dom.hskButtonsContainer.addEventListener('scroll', () => {
                if (this.dom.hskButtonsContainer.scrollLeft > 30) this.dom.hskHint.classList.add('fade-out');
            }, { passive: true });
        }
        
        if (this.dom.tableWrapper && this.dom.tableHint) {
            this.dom.tableWrapper.addEventListener('scroll', () => {
                if (this.dom.tableWrapper.scrollLeft > 100) this.dom.tableHint.classList.add('fade-out');
            }, { passive: true });
        }

        document.addEventListener('keydown', (e) => {
            const isInputFocused = document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA';
            const isModalOpen = this.dom.practiceModal.classList.contains('show');

            if (!isInputFocused && this.activeRowElement && !isModalOpen) {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault(); 
                    let targetRow;
                    if (e.key === 'ArrowDown') targetRow = this.activeRowElement.nextElementSibling;
                    else if (e.key === 'ArrowUp') targetRow = this.activeRowElement.previousElementSibling;

                    if (targetRow && targetRow.classList.contains('sentenceRow')) {
                        targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        targetRow.click();
                    }
                }
            }
        });        

        window.addEventListener('resize', () => {
            this.checkOverflows();
        });
    }

    startPractice() {
        if (this.historyData.length === 0) {
            this.showError("Bảng dữ liệu đang trống!");
            return;
        }

        let start = parseInt(this.dom.practiceStart.value);
        let end = parseInt(this.dom.practiceEnd.value);
        
        if (isNaN(start)) start = 1;
        if (isNaN(end)) end = Math.min(this.historyData.length, start + 4);

        if (start < 1 || end > this.historyData.length || start > end) {
            this.showError(`Phạm vi không hợp lệ. Vui lòng nhập từ 1 đến ${this.historyData.length}`);
            return;
        }

        this.dom.practiceContainer.innerHTML = '';
        let hasValidSentences = false;

        for (let i = start - 1; i <= end - 1; i++) {
            let item = this.historyData[i];
            let textToPractice = item.text || item.vocab; 
            
            if (!textToPractice) continue;
            hasValidSentences = true;

            const block = this.createExerciseBlock(i + 1, textToPractice, item.meaning || item.wordMeaning, item.pinyin || item.wordPinyin);
            this.dom.practiceContainer.appendChild(block);
        }

        if(hasValidSentences) {
            this.dom.practiceModal.classList.add('show');
            this.dom.practiceModal.scrollTo(0,0);
        } else {
            this.showError("Các câu trong khoảng đã chọn không có dữ liệu để ghép!");
        }
    }

createExerciseBlock(sentenceIndex, originalText, meaning, pinyinText) {
        const block = document.createElement('div');
        block.className = 'exercise-block';

        // LOẠI BỎ DẤU CÂU TRƯỚC KHI TẠO Ô TRỐNG
        const cleanText = originalText.replace(/[。，？！、：；.,?!:;]/g, '').trim();

        // Title
        const title = document.createElement('div');
        title.className = 'exercise-title';
        title.innerHTML = `Câu ${sentenceIndex}: ${meaning || 'Không có dịch nghĩa'} <span class="pinyin-hint">(${pinyinText || 'Không có pinyin'})</span>`;
        block.appendChild(title);

        const slotsArea = document.createElement('div');
        slotsArea.className = 'slots-area';

        const wordsArea = document.createElement('div');
        wordsArea.className = 'words-area';

        // Actions Area (chứa thông báo đúng/sai và các nút)
        const actionsArea = document.createElement('div');
        actionsArea.className = 'exercise-actions';

        const statusText = document.createElement('div');
        statusText.className = 'exercise-status';

        const btnGroup = document.createElement('div');
        btnGroup.className = 'action-group';

        // NÚT MỚI: PHÁT ÂM (NGHE ĐỌC)
        const speakBtn = document.createElement('button');
        speakBtn.className = 'reset-btn speak-btn';
        speakBtn.innerHTML = '<i class="fas fa-volume-up"></i> Phát âm';

        const showBtn = document.createElement('button');
        showBtn.className = 'reset-btn hint-btn';
        showBtn.innerHTML = '<i class="fas fa-eye"></i> Xem đáp án';

        const resetBtn = document.createElement('button');
        resetBtn.className = 'reset-btn';
        resetBtn.innerHTML = '<i class="fas fa-undo"></i> Làm lại';

        // Xáo trộn chữ (Sử dụng text đã xóa dấu câu)
        const chars = cleanText.split('');
        const scrambled = [...chars].sort(() => Math.random() - 0.5);

        const slotElements = [];
        const wordElements = [];

        // Tạo các ô trống
        chars.forEach((char, idx) => {
            const slot = document.createElement('div');
            slot.className = 'slot';
            
            // Tách logic ra để dùng chung cho cả Click và Hover
            const handleSlotAction = () => {
                if (slot.innerText !== '') {
                    if (slot.linkedChip) {
                        slot.linkedChip.classList.remove('hidden');
                        slot.linkedChip = null;
                    }
                    
                    slot.innerText = '';
                    slot.classList.remove('filled');
                    statusText.innerText = '';
                    statusText.className = 'exercise-status';
                }
            };

            // Gắn sự kiện: Bấm (cho điện thoại) và Hover (cho máy tính)
            slot.onclick = handleSlotAction;
            slot.onmouseenter = handleSlotAction;

            slotsArea.appendChild(slot);
            slotElements.push(slot);
        });

        // Hàm kiểm tra đúng/sai
        const checkWin = () => {
            const currentString = slotElements.map(s => s.innerText).join('');
            if (currentString.length === cleanText.length) {
                if (currentString === cleanText) {
                    statusText.innerText = 'Chính xác! 🎉';
                    statusText.className = 'exercise-status text-green';
                    this.speak(originalText);
                } else {
                    statusText.innerText = 'Chưa đúng vị trí, hãy thử lại nhé!';
                    statusText.className = 'exercise-status text-red';
                }
            }
        };

        // Tạo các chip từ xáo trộn
        scrambled.forEach((char, idx) => {
            const chip = document.createElement('div');
            chip.className = 'word-chip';
            chip.innerText = char;
            
            // Tách logic ra để dùng chung cho cả Click và Hover
            const handleChipAction = () => {
                if(chip.classList.contains('hidden')) return;
                
                const emptySlot = slotElements.find(s => s.innerText === '');
                if (emptySlot) {
                    emptySlot.innerText = char;
                    emptySlot.classList.add('filled');
                    
                    emptySlot.linkedChip = chip; 
                    
                    chip.classList.add('hidden');
                    checkWin(); 
                }
            };

            // Gắn sự kiện: Bấm (cho điện thoại) và Hover (cho máy tính)
            chip.onclick = handleChipAction;
            chip.onmouseenter = handleChipAction;

            wordsArea.appendChild(chip);
            wordElements.push(chip);
        });

        // --- SỰ KIỆN CÁC NÚT ---
        
        // Sự kiện Phát âm khi hover (onmouseenter) và ngưng khi đưa chuột ra (onmouseleave)
        // (Thêm sự kiện onclick hỗ trợ riêng cho trường hợp bạn bấm trên màn hình cảm ứng điện thoại)
        speakBtn.onmouseenter = () => { this.speak(originalText); };
        speakBtn.onmouseleave = () => { speechSynthesis.cancel(); };
        speakBtn.onclick = () => { this.speak(originalText); };

        showBtn.onclick = () => {
            statusText.innerText = `Đáp án: ${cleanText}`;
            statusText.className = 'exercise-status text-blue';
        };

        resetBtn.onclick = () => {
            slotElements.forEach(slot => {
                slot.innerText = '';
                slot.classList.remove('filled');
                slot.linkedChip = null;
            });
            wordElements.forEach(chip => {
                chip.classList.remove('hidden');
            });
            statusText.innerText = '';
            statusText.className = 'exercise-status';
        };

        // Gắn các nút vào nhóm
        btnGroup.appendChild(speakBtn);
        btnGroup.appendChild(showBtn);
        btnGroup.appendChild(resetBtn);
        
        actionsArea.appendChild(statusText);
        actionsArea.appendChild(btnGroup);

        block.appendChild(slotsArea);
        block.appendChild(wordsArea);
        block.appendChild(actionsArea);
        return block;
    }
    
    checkOverflows() {
        setTimeout(() => {
            if (this.dom.hskButtonsContainer && this.dom.hskHint) {
                const hskCont = this.dom.hskButtonsContainer;
                this.dom.hskHint.classList.remove('fade-out');
                if (hskCont.scrollWidth > hskCont.clientWidth + 2) {
                    this.dom.hskHint.classList.remove('hidden-by-js');
                } else {
                    this.dom.hskHint.classList.add('hidden-by-js');
                }
            }

            if (this.dom.tableWrapper && this.dom.tableHint) {
                const tableCont = this.dom.tableWrapper;
                this.dom.tableHint.classList.remove('fade-out');
                if (tableCont.scrollWidth > tableCont.clientWidth + 2) {
                    this.dom.tableHint.classList.remove('hidden-by-js');
                } else {
                    this.dom.tableHint.classList.add('hidden-by-js');
                }
            }
        }, 100);
    }

    jumpToRow() {
        const targetNumber = parseInt(this.dom.jumpInput.value);
        if (isNaN(targetNumber) || targetNumber < 1 || targetNumber > this.historyData.length) {
            this.showError("Số thứ tự không tồn tại trong bảng!");
            return;
        }
        
        const rows = document.querySelectorAll('.sentenceRow');
        const targetRow = rows[targetNumber - 1]; 
        
        if (targetRow) {
            targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetRow.click();
            
            const originalBg = targetRow.style.background;
            targetRow.style.background = "#fef08a";
            setTimeout(() => { targetRow.style.background = originalBg; }, 1500);
        }
        this.dom.jumpInput.value = "";
    }

    initScrollEvents() {
        let isScrolling = false;
        window.addEventListener("scroll", () => {
            if (!isScrolling) {
                window.requestAnimationFrame(() => {
                    if (this.dom.searchWrapper) {
                        if (window.scrollY >= 80) this.dom.searchWrapper.classList.add("fixed");
                        else this.dom.searchWrapper.classList.remove("fixed");
                    }
                    if (this.dom.backToTop) {
                        this.dom.backToTop.style.display = window.scrollY > 300 ? "block" : "none";
                    }
                    isScrolling = false;
                });
                isScrolling = true;
            }
        });
    }

    loadInitialData() {
        try {
            const saved = localStorage.getItem(this.LOCAL_KEY);
            if (saved) this.historyData = JSON.parse(saved);
        } catch(e) {
            console.error("Lỗi parse localStorage:", e);
            this.historyData = [];
            localStorage.removeItem(this.LOCAL_KEY);
        }
        this.renderHistory();
    }

    saveData() {
        localStorage.setItem(this.LOCAL_KEY, JSON.stringify(this.historyData));
    }

    async loadHSK(level) {
        const hskPaths = {
            "HSK 1": "./data/hsk1.json", "HSK 2": "./data/hsk2.json", "HSK 3": "./data/hsk3.json",
            "HSK 4": "./data/hsk4.json", "HSK 5": "./data/hsk5.json", "HSK 6": "./data/hsk6.json",
            "HSK 1 (3.0)": "./data/hsk1_3.json", "HSK 2 (3.0)": "./data/hsk2_3.json", 
            "HSK 3 (3.0)": "./data/hsk3_3.json", "HSK 4 (3.0)": "./data/hsk4_3.json", "HSK 5 (3.0)": "./data/hsk5_3.json"
        };

        try {
            const filePath = hskPaths[level];
            if(!filePath) return;
            const res = await fetch(filePath);
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
            
            const data = await res.json();
            this.historyData = data.map(r => ({
                vocab: r['Từ vựng'] || "", wordPinyin: r['Phiên âm từ'] || "", type: r['Loại từ'] || "",
                wordMeaning: r['Nghĩa từ'] || "", text: r['Ví dụ'] || "",
                pinyin: r['Phiên âm câu'] || "", meaning: r['Dịch'] || ""
            }));
            this.renderHistory();
        } catch(err) {
            this.showError(`Không load được file JSON: ${level}. Kiểm tra Server hoặc Console.`);
            console.error(err);
        }
    }

async processSearch() {
    const text = this.dom.searchInput.value.trim();
    if (!text) return;

    const originalBtnText = this.dom.findBtn.innerText;
    this.dom.findBtn.innerText = "Finding...";
    this.dom.findBtn.disabled = true;

    try {
        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=zh-CN|vi`);
        const data = await res.json();
        const translatedText = data?.responseData?.translatedText || "";

        const isWord = text.length <= 4;

        const newItem = {
            vocab: isWord ? text : "",
            wordPinyin: isWord ? pinyinPro.pinyin(text) : "",
            type: "", 
            wordMeaning: isWord ? translatedText : "",
            text: isWord ? "" : text,
            pinyin: isWord ? "" : pinyinPro.pinyin(text),
            meaning: isWord ? "" : translatedText
        };

        this.historyData.push(newItem);
        this.renderHistory();
        
        setTimeout(() => {
            const rows = document.querySelectorAll('.sentenceRow');
            if (rows.length > 0) rows[rows.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);

        this.dom.searchInput.value = "";
    } catch (error) {
        this.showError("Không thể tra cứu nghĩa lúc này. Vui lòng thử lại!");
        console.error("Lỗi dịch:", error);
    } finally {
        this.dom.findBtn.innerText = originalBtnText;
        this.dom.findBtn.disabled = false;
    }
}

    clearAll() {
        this.historyData = [];
        this.renderHistory();
        this.dom.animationWrapper.classList.remove("show");
    }

    importExcel(e) {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = event => {
            const data = new Uint8Array(event.target.result);
            const wb = XLSX.read(data, {type: 'array'});
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet);
            this.historyData = rows.map(r => ({
                vocab: r['Từ vựng'], wordPinyin: r['Phiên âm từ'], type: r['Loại từ'],
                wordMeaning: r['Nghĩa từ'], text: r['Ví dụ'], pinyin: r['Phiên âm câu'], meaning: r['Dịch']
            }));
            this.renderHistory();
        };
        reader.readAsArrayBuffer(file);
    }

    renderHistory() {
        this.dom.sentenceList.innerHTML = "";
        const fragment = document.createDocumentFragment();
        
        this.historyData.forEach((item, index) => {
            const row = document.createElement("div"); 
            row.className = "sentenceRow";
            row.innerHTML = `
                <div>${index + 1}</div>
                <div><button class='playVocab'>🔊</button>${item.vocab || ""}</div>
                <div>${item.wordPinyin || ""}</div>
                <div>${item.type || ""}</div>
                <div>${item.wordMeaning || ""}</div>
                <div>${item.text || ""}</div>
                <div>${item.pinyin || ""}</div>
                <div>${item.meaning || ""}</div>
                <div><span class='deleteBtn'>X</span></div>            `;
            
            row.onclick = () => {
                document.querySelectorAll('.sentenceRow').forEach(r => r.classList.remove('activeRow'));
                row.classList.add('activeRow'); 
                this.activeRowElement = row;
                
                const textToProcess = item.text || item.vocab || "";
                
                this.drawCharacters(textToProcess, item.vocab || ""); 
                this.speak(textToProcess);
            };

            const delBtn = row.querySelector(".deleteBtn");
            if(delBtn) delBtn.onclick = (e) => {
                e.stopPropagation();
                this.historyData.splice(index, 1);
                this.renderHistory();
            };

            const playBtn = row.querySelector('.playVocab');
            if(playBtn) {
                playBtn.onclick = (e) => { e.stopPropagation(); this.speak(item.vocab || item.text); };
                playBtn.onmouseenter = (e) => { e.stopPropagation(); if(item.vocab || item.text) this.speak(item.vocab || item.text); };
                playBtn.onmouseleave = (e) => { e.stopPropagation(); speechSynthesis.cancel(); };
            }
            fragment.appendChild(row);
        });
        
        this.dom.sentenceList.appendChild(fragment);
        this.saveData();
        this.checkOverflows();
    }

    isChinese(c) { return /[\u4e00-\u9fff]/.test(c); }

    async translateChar(char) {
        if(this.charCache[char]) return this.charCache[char];
        if(this.pendingTranslations[char]) return this.pendingTranslations[char];
        try {
            const fetchPromise = fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(char)}&langpair=zh-CN|vi`)
                .then(res => res.json())
                .then(data => {
                    const result = data?.responseData?.translatedText || char;
                    this.charCache[char] = result;
                    localStorage.setItem("charCache", JSON.stringify(this.charCache));
                    delete this.pendingTranslations[char];
                    return result;
                });
            this.pendingTranslations[char] = fetchPromise;
            return fetchPromise;
        } catch(e) { return char; }
    }

    async drawCharacters(text, vocab = "") {
        this.dom.animationArea.innerHTML = "";
        this.dom.animationWrapper.classList.add("show");
        this.currentRenderedText = text;
        this.currentDrawSession++; 
        const mySession = this.currentDrawSession;

        const chars = [...text];
        const fragment = document.createDocumentFragment();

        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            if (!this.isChinese(char)) continue;

            const box = document.createElement("div"); box.className = "charBox";
            const infoDiv = document.createElement("div"); infoDiv.className = "char-info";
            const py = document.createElement("div"); py.className = "pinyin";
            py.innerText = pinyinPro.pinyin(char);
            if (vocab.includes(char)) py.style.color = "#ef4444";

            const mean = document.createElement("div"); mean.className = "meaningChar"; mean.innerText = "...";
            this.translateChar(char).then(res => { if(mySession === this.currentDrawSession) mean.innerText = res; });

            const btn = document.createElement("button"); btn.className = "playChar"; btn.innerText = "🔊";
            btn.onclick = (e) => { e.stopPropagation(); this.speak(char); };

            infoDiv.append(py, mean, btn);
            const wdiv = document.createElement("div"); wdiv.className = "writer";

            box.append(infoDiv, wdiv);
            fragment.appendChild(box);
        }
        this.dom.animationArea.appendChild(fragment);

        let charIndex = 0;
        for (let i = 0; i < chars.length; i++) {
            if (!this.isChinese(chars[i])) continue;
            
            const targetElement = this.dom.animationArea.children[charIndex].querySelector('.writer');
            charIndex++;

            const isTargetVocab = vocab.includes(chars[i]);

            const writer = HanziWriter.create(targetElement, chars[i], {
                width: 100, 
                height: 100, 
                strokeAnimationSpeed: 3, 
                delayBetweenStrokes: 30, 
                padding: 5,
                strokeColor: isTargetVocab ? '#ef4444' : '#555555' 
            });

            const loop = () => {
                if (mySession !== this.currentDrawSession) return; 
                writer.animateCharacter({ onComplete: () => {
                    setTimeout(() => { if (mySession === this.currentDrawSession) loop(); }, 500);
                }});
            };
            loop();
        }
    }

    speak(text) {
        const u = new SpeechSynthesisUtterance(text); 
        u.lang = "zh-CN"; 
        u.rate = this.speechRate;
        speechSynthesis.cancel(); 
        speechSynthesis.speak(u);
    }

    toggleSpeed() {
        this.isLowSpeed = !this.isLowSpeed;
        this.speechRate = this.isLowSpeed ? 0.5 : 1;
        this.dom.speedBtn.innerText = this.isLowSpeed ? "LOW SPEED" : "NORMAL SPEED";
    }

    toggleRepeat() {
        if(!this.isRepeating) {
            if(!this.currentRenderedText) return;
            speechSynthesis.cancel(); 
            const u = new SpeechSynthesisUtterance(this.currentRenderedText);
            u.lang = "zh-CN"; u.rate = this.speechRate;
            u.onstart = () => { this.isRepeating = true; this.dom.repeatBtn.textContent = "STOP"; this.dom.repeatBtn.style.background = "red"; };
            u.onend = () => { this.isRepeating = false; this.dom.repeatBtn.textContent = "Repeat"; this.dom.repeatBtn.style.background = ""; };
            speechSynthesis.speak(u);
        } else {
            speechSynthesis.cancel();
            this.isRepeating = false;
            this.dom.repeatBtn.textContent = "Repeat";
            this.dom.repeatBtn.style.background = "";
        }
    }

    scrollToActiveRow() {
        if (this.activeRowElement) {
            this.activeRowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            this.activeRowElement.style.transition = "background 0.5s";
            const originalBg = this.activeRowElement.style.background;
            this.activeRowElement.style.background = "#fef08a";
            setTimeout(() => { this.activeRowElement.style.background = originalBg; }, 1000);
        } else {
            this.dom.sentenceSection.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    showError(message) {
        this.dom.errorMsg.innerText = message;
        this.dom.errorMsg.style.display = "block";
        setTimeout(() => { this.dom.errorMsg.style.display = "none"; }, 5000); 
    }

    initPullToRefresh() {
        if (window.innerWidth > 768) return;
        let startY = 0, currentY = 0, isPulling = false;
        
        document.addEventListener("touchstart", (e) => {
            // Chặn refresh khi đang lướt ở bảng câu HOẶC màn hình luyện tập
            if (e.target.closest(".sentence-section") || e.target.closest(".practice-modal")) return;
            startY = e.touches[0].clientY; isPulling = true;
        }, {passive: true});

        document.addEventListener("touchmove", (e) => {
            if (!isPulling) return;
            currentY = e.touches[0].clientY;
            let diff = currentY - startY;
            if (diff > 0) {
                this.dom.pullLoader.classList.add("show");
                this.dom.pullLoader.style.transform = `translateX(-50%) scale(${Math.min(diff / 100, 1)})`;
            }
        }, {passive: true});

        document.addEventListener("touchend", () => {
            if (!isPulling) return;
            if (currentY - startY > 100) {
                this.dom.pullLoader.classList.add("spin");
                setTimeout(() => location.reload(), 300);
            }
            this.dom.pullLoader.classList.remove("show", "spin");
            this.dom.pullLoader.style.transform = "translateX(-50%) scale(0)";
            isPulling = false;
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    new LearnChineseApp();
});
