
let historyData=[];
let currentRenderedText="";
let activeRowElement=null;
let speechRate = 1;
let isLowSpeed = false;
let isRepeating = false;

const searchWrapper = document.getElementById("searchWrapper");
const searchOffset = searchWrapper.offsetTop;

function reloadPage(){
    location.reload();
}

window.addEventListener("scroll", function() {
    if (window.scrollY >= searchOffset) {
        searchWrapper.classList.add("fixed");
    } else {
        searchWrapper.classList.remove("fixed");
    }

    const backToTop = document.getElementById("backToTop");
    if (window.scrollY > 300) {
        backToTop.style.display = "block";
    } else {
        backToTop.style.display = "none";
    }
});

function speak(text){
    const u=new SpeechSynthesisUtterance(text); 
    u.lang="zh-CN"; 
    u.rate = speechRate;
    speechSynthesis.cancel(); 
    speechSynthesis.speak(u);
}

function toggleSpeed(){
    isLowSpeed = !isLowSpeed;
    if(isLowSpeed){
        speechRate = 0.5;
        document.getElementById("speedBtn").innerText = "LOW SPEED";
    }else{
        speechRate = 1;
        document.getElementById("speedBtn").innerText = "NORMAL SPEED";
    }
}

function toggleAnimation(){
    const wrapper=document.getElementById("animationWrapper");
    wrapper.classList.toggle("show");
}

function isChinese(c){return /[\u4e00-\u9fff]/.test(c);}

async function translateChar(char){
    try{
        const res=await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(char)}&langpair=zh-CN|vi`);
        const data=await res.json();
        return data.responseData.translatedText || char;
    }catch(e){ return char; }
}

async function drawCharacters(text, vocab = "") {
    const wrapper = document.getElementById("animationWrapper");
    const area = document.getElementById("animationArea");
    area.innerHTML = "";
    wrapper.classList.add("show");
    currentRenderedText = text;

    const chars = [...text];
    for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        if (!isChinese(char)) continue;

        const box = document.createElement("div");
        box.className = "charBox";

        // --- DIV CON 1: Nhóm thông tin ---
        const infoDiv = document.createElement("div");
        infoDiv.className = "char-info";

        const py = document.createElement("div");
        py.className = "pinyin";
        py.innerText = pinyinPro.pinyin(char);
        if (vocab.includes(char)) py.style.color = "#ef4444";

        const mean = document.createElement("div");
        mean.className = "meaningChar";
        mean.innerText = "...";
        translateChar(char).then(res => { mean.innerText = res; });

        const btn = document.createElement("button");
        btn.className = "playChar";
        btn.innerText = "🔊";
        btn.onclick = (e) => { e.stopPropagation(); speak(char); };

        infoDiv.append(py, mean, btn);

        // --- DIV CON 2: Khối vẽ chữ (SVG) ---
        const wdiv = document.createElement("div");
        const uniqueId = "w" + i + Date.now();
        wdiv.id = uniqueId;
        wdiv.className = "writer";

        // Cho vào box (chỉ có 2 con)
        box.append(infoDiv, wdiv);
        area.appendChild(box);

        // Khởi tạo HanziWriter
        const writer = HanziWriter.create(uniqueId, char, {
            width: 100,
            height: 100,
            strokeAnimationSpeed: 3,
            delayBetweenStrokes: 30,
            padding: 5
        });

        function loop() {
            writer.animateCharacter({ onComplete: loop });
        }
        loop();
    }
}
function renderHistory(){
    const list=document.getElementById("sentenceList");
    list.innerHTML="";
    
    historyData.forEach((item,index)=>{
        const row=document.createElement("div"); 
        row.className="sentenceRow";
        row.innerHTML=`
            <div>${index+1}</div>
            <div>
                <button class='playVocab'>🔊</button>${item.vocab||""}
            </div>
            <div>${item.wordPinyin||""}</div>
            <div>${item.type||""}</div>
            <div>${item.wordMeaning||""}</div>
            <div>${item.text||""}</div>
            <div>${item.pinyin||""}</div>
            <div>${item.meaning||""}</div>
            <div>${item.text ? "<span class='deleteBtn'>X</span>" : ""}</div>
        `;
        row.onclick=()=>{
            document.querySelectorAll('.sentenceRow').forEach(r=>r.classList.remove('activeRow'));
            row.classList.add('activeRow'); 
            activeRowElement=row;
            drawCharacters(item.text, item.vocab || ""); 
            speak(item.text);
        };
        row.querySelector(".deleteBtn")?.addEventListener("click",(e)=>{
            e.stopPropagation();
            historyData.splice(index,1);
            renderHistory();
        });
        const playBtn = row.querySelector('.playVocab');
        if(playBtn){
            playBtn.addEventListener('click',(e)=>{
                e.stopPropagation();
                speak(item.vocab||item.text);
            });
            playBtn.addEventListener('mouseenter',(e)=>{
                e.stopPropagation();
                if(item.vocab || item.text) speak(item.vocab||item.text);
            });
            playBtn.addEventListener('mouseleave',(e)=>{
                e.stopPropagation();
                speechSynthesis.cancel();
            });
        }
        list.appendChild(row);
    });
}

function importExcel(){
    const file=document.getElementById('excelFile').files[0];
    const reader=new FileReader();
    reader.onload=e=>{
        const data=new Uint8Array(e.target.result);
        const wb=XLSX.read(data,{type:'array'});
        const sheet=wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(sheet);
        historyData=rows.map(r=>({
            vocab:r['Từ vựng'],
            wordPinyin:r['Phiên âm từ'],
            type:r['Loại từ'],
            wordMeaning:r['Nghĩa từ'],
            text:r['Ví dụ'],
            pinyin:r['Phiên âm câu'],
            meaning:r['Dịch']
        }));
        renderHistory();
    };
    reader.readAsArrayBuffer(file);
}

function process(){
    const text=document.getElementById("inputText").value;
    if(!text) return;
    historyData.push({text,pinyin:pinyinPro.pinyin(text),wordMeaning:""});
    renderHistory();
    document.getElementById('inputText').value="";
}

function clearAll(){
    historyData = [];
    renderHistory();
    document.getElementById("animationWrapper").classList.remove("show");
}

function startRepeat(){
    const button = document.getElementById("repeatBtn");
    if(!currentRenderedText || !currentRenderedText.trim()) return;
    if(isRepeating) return;
    isRepeating = true;
    button.textContent = "STOP";
    button.style.background = "red";
    const u = new SpeechSynthesisUtterance(currentRenderedText);
    u.lang = "zh-CN";
    u.rate = speechRate;
    u.onend = () => {
        isRepeating = false;
        button.textContent = "Repeat";
        button.style.background = "";
    };
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
}

function stopRepeat(){
    const button = document.getElementById("repeatBtn");
    if(!isRepeating) return;
    speechSynthesis.cancel();
    isRepeating = false;
    button.textContent = "Repeat";
    button.style.background = "";
}

function repeatSentence(){
    if(!isRepeating) startRepeat(); else stopRepeat();
}

function scrollToActiveRow() {
    if (activeRowElement) {
        // block: 'center' sẽ đưa dòng đang chọn vào giữa khung nhìn của danh sách
        activeRowElement.scrollIntoView({
            behavior: 'smooth', 
            block: 'center' 
        });

        // Hiệu ứng nháy nhẹ để người dùng biết dòng nào đang được focus (tùy chọn)
        activeRowElement.style.transition = "background 0.5s";
        const originalBg = activeRowElement.style.background;
        activeRowElement.style.background = "#fef08a"; // Màu vàng nhạt
        setTimeout(() => {
            activeRowElement.style.background = originalBg;
        }, 1000);

    } else {
        // Nếu chưa chọn câu nào thì cuộn lên đầu danh sách
        document.getElementById("sentenceSection").scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }
}

/* ================= LOAD JSON HSK ================= */
const hskFiles = {
    "HSK 1": "/data/hsk1.json",
    "HSK 2": "/data/hsk2.json",
    "HSK 3": "/data/hsk3.json",
    "HSK 4": "/data/hsk4.json",
    "HSK 5": "/data/hsk5.json",
    "HSK 6": "/data/hsk6.json",
    "HSK 1 (3.0)": "data/hsk1_3.json",
    "HSK 2 (3.0)": "data/hsk2_3.json",
    "HSK 3 (3.0)": "data/hsk3_3.json",
    "HSK 4 (3.0)": "data/hsk4_3.json",
    "HSK 5 (3.0)": "data/hsk5_3.json"
};

async function loadHSK(level){
    try{
        const file = hskFiles[level];
        if(!file) return;
        const res = await fetch(file);
        const data = await res.json();

        historyData = data.map(r=>({
            vocab:r['Từ vựng'],
            wordPinyin:r['Phiên âm từ'],
            type:r['Loại từ'],
            wordMeaning:r['Nghĩa từ'],
            text:r['Ví dụ'],
            pinyin:r['Phiên âm câu'],
            meaning:r['Dịch']
        }));

        renderHistory();
    }catch(err){
        showError("Không load được file JSON: " + level);
        console.error(err);
    }
}

document.querySelectorAll(".hskBtn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
        const level = btn.innerText.trim();
        loadHSK(level);
    });
});

function scrollToTop() {
    window.scrollTo({top: 0, behavior: 'smooth'});
}

function showError(message) {
    const errorDiv = document.getElementById("errorMessage");
    errorDiv.innerText = message;
    errorDiv.style.display = "block";
    setTimeout(() => {
        errorDiv.style.display = "none";
    }, 5000); // Ẩn sau 5 giây
}
// Lưu dữ liệu
function saveData() {
    localStorage.setItem('hsk_history', JSON.stringify(historyData));
}

//initPullToRefresh: Kéo xuống để làm mới trang (chỉ trên mobile)
function initPullToRefresh() {

    if (window.innerWidth > 768) return;

    let startY = 0;
    let currentY = 0;
    let isPulling = false;
    const threshold = 100;

    const loader = document.getElementById("pullLoader");

    document.addEventListener("touchstart", (e) => {
        if (e.target.closest("#sentenceSection")) return;

        startY = e.touches[0].clientY;
        isPulling = true;
    });

    document.addEventListener("touchmove", (e) => {
        if (!isPulling) return;

        currentY = e.touches[0].clientY;
        let diff = currentY - startY;

        if (diff > 0) {
            loader.classList.add("show");

            // scale theo lực kéo (max 1)
            let scale = Math.min(diff / threshold, 1);
            loader.style.transform = `translateX(-50%) scale(${scale})`;
        }
    });

    document.addEventListener("touchend", () => {
        if (!isPulling) return;

        let diff = currentY - startY;

        if (diff > threshold) {
            loader.classList.add("spin");

            setTimeout(() => {
                location.reload();
            }, 300);
        }

        // reset
        loader.classList.remove("show", "spin");
        loader.style.transform = "translateX(-50%) scale(0)";

        isPulling = false;
    });
}

// Load dữ liệu khi mở trang
window.onload = () => {
    const saved = localStorage.getItem('hsk_history');
    if (saved) {
        historyData = JSON.parse(saved);
        renderHistory();
    }
    initPullToRefresh();
};
