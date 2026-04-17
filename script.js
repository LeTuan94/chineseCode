class LearnChineseApp {
    constructor() {
        // State (Trạng thái dữ liệu)
        this.historyData = [];
        this.currentRenderedText = "";
        this.activeRowElement = null;
        this.speechRate = 1;
        this.isLowSpeed = false;
        this.isRepeating = false;
        this.currentDrawSession = 0;
        this.pendingTranslations = {};
        
        // Cache & LocalStorage
        this.charCache = JSON.parse(localStorage.getItem("charCache")) || {};
        this.LOCAL_KEY = 'hsk_history';

        // DOM Elements (Chọn qua class)
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
            pullLoader: document.querySelector('.pull-loader')
        };

        this.init();
    }

    init() {
        this.loadInitialData();
        this.bindEvents();
        this.initPullToRefresh();
        this.initScrollEvents();
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

    // --- LOGIC GỌI DATA & RENDER ---
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

    processSearch() {
        const text = this.dom.searchInput.value.trim();
        if(!text) return;
        this.historyData.push({text, pinyin: pinyinPro.pinyin(text), wordMeaning: ""});
        this.renderHistory();
        this.dom.searchInput.value = "";
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
                <div>${item.text ? "<span class='deleteBtn'>X</span>" : ""}</div>
            `;
            
            row.onclick = () => {
                document.querySelectorAll('.sentenceRow').forEach(r => r.classList.remove('activeRow'));
                row.classList.add('activeRow'); 
                this.activeRowElement = row;
                this.drawCharacters(item.text, item.vocab || ""); 
                this.speak(item.text);
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
    }

    // --- ANIMATION & TTS ---
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

            // Kiểm tra xem chữ Hán hiện tại (chars[i]) có nằm trong Từ vựng (vocab) hay không
            const isTargetVocab = vocab.includes(chars[i]);

            const writer = HanziWriter.create(targetElement, chars[i], {
                width: 100, 
                height: 100, 
                strokeAnimationSpeed: 3, 
                delayBetweenStrokes: 30, 
                padding: 5,
                // Nếu là từ vựng đang học -> đổi màu (Ví dụ: màu đỏ). Nếu không phải -> màu xám đậm.
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

    // --- HELPERS ---
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
            if (e.target.closest(".sentence-section")) return;
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

// Khởi chạy App khi trang đã tải xong
document.addEventListener("DOMContentLoaded", () => {
    new LearnChineseApp();
});
