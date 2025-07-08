document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素 ---
    const testSelect = document.getElementById('testSelect');
    const categorySelect = document.getElementById('categorySelect');
    const startReadingBtn = document.getElementById('startReading');
    const startTestBtn = document.getElementById('startTest');
    const reviewMistakesBtn = document.getElementById('reviewMistakes');
    const reviewMarkedBtn = document.getElementById('reviewMarkedBtn');
    const exportRecordsBtn = document.getElementById('exportRecordsBtn');
    const importRecordsBtn = document.getElementById('importRecordsBtn');
    const welcomeScreen = document.getElementById('welcomeScreen');
    const questionContainer = document.getElementById('questionContainer');
    const testResultContainer = document.getElementById('testResult');
    const timerDisplay = document.getElementById('timerDisplay');
    const endTestBtn = document.getElementById('endTestBtn');
    const questionNumber = document.getElementById('questionNumber');
    const questionText = document.getElementById('questionText');
    const optionsContainer = document.getElementById('optionsContainer');
    const answerSection = document.getElementById('answerSection');
    const correctAnswerSpan = document.getElementById('correctAnswer');
    const showAnswerBtn = document.getElementById('showAnswerBtn');
    const modeIndicator = document.getElementById('modeIndicator');
    const progressText = document.getElementById('progressText');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const markBtn = document.getElementById('markBtn');
    const deleteMistakeBtn = document.getElementById('deleteMistakeBtn');

    // --- 設定 UI 元素 ---
    const themeSwitch = document.getElementById('theme-switch');
    const fontSizeIncreaseBtn = document.getElementById('font-size-increase');
    const fontSizeDecreaseBtn = document.getElementById('font-size-decrease');
    const fontSizeResetBtn = document.getElementById('font-size-reset');
  
    // --- 狀態變數 ---
    let allQuestions = [];
    let userAnswers = {}; // { qId: userAnswer }
    let timer = null;
    let timeLeft = 0;
    let incorrectMistakes = {}; // { qId: questionObject }
    let currentQuestionIndex = 0;
    let currentMode = ''; // 'reading', 'test', 'review_incorrect', 'review_marked'
    let score = 0;

    // 取得題目的唯一鍵（來源+題號）
    function getQuestionKey(q) {
      return `${q.source || 'unknown'}|${q.id}`;
    }

    // 根據答案key取得選項的完整文字
    function getOptionText(question, answerKey) {
      if (!answerKey) return '(未作答)';

      // 處理是非題 (更穩健的判斷方式)
      if (question.options && question.options.length === 2 && question.options[0].includes('O') && question.options[1].includes('X')) {
        if (answerKey === '1') return question.options[0]; // e.g., "1. O"
        if (answerKey === '2') return question.options[1]; // e.g., "2. X"
      }

      const upperAnswerKey = answerKey.toUpperCase();
      const option = question.options.find(opt => {
        const trimmedOpt = opt.trim().toUpperCase();
        // 匹配 'A.' 或 '1.' 開頭
        return trimmedOpt.startsWith(upperAnswerKey + '.');
      });

      // 如果找不到選項文字，至少顯示選擇的key
      return option || `(您選擇的答案: ${answerKey})`;
    }

    // 將 localStorage 中的標記狀態套用到目前的 allQuestions
    function applyMarkedStatus() {
      const stored = loadMarkedQuestionsFromStorage();
      const markedSet = new Set(stored.map(getQuestionKey));
      allQuestions.forEach(q => {
        q.marked = markedSet.has(getQuestionKey(q));
      });
    }
  
    // --- 初始化 ---
    function initialize() {
      loadIncorrectMistakesFromStorage();
      populateTestSelect(); // 這會觸發 change 事件
      setupEventListeners();
      loadSettings(); // 載入主題和字體設定
      updateReviewMistakesButtonState();
      updateReviewMarkedButtonState();
      backToMenu();

      console.log('本地錯題:', localStorage.getItem('gpl_incorrect_mistakes'));
      console.log('本地標記:', localStorage.getItem('gpl_marked_questions'));
    }
  
    function populateTestSelect() {
      testSelect.innerHTML = ''; // 清空
      
      const allOption = document.createElement('option');
      
      for (let i = 1; i <= 10; i++) {
        const option = document.createElement('option');
        option.value = `測驗${i}`;
        option.textContent = `測驗 ${i}`;
        testSelect.appendChild(option);
      }
      // 預設選中'全部'
      allOption.value = 'all';
      allOption.textContent = '全部';
      testSelect.appendChild(allOption);
      
      testSelect.value = '測驗1';
      populateCategorySelect(); // 鏈式調用
    }
  
    function populateCategorySelect() {
      const selectedTest = testSelect.value;
      categorySelect.innerHTML = '';
      if (!selectedTest) {
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '-- 請先選擇測驗 --';
        categorySelect.appendChild(defaultOption);
        return;
      }
      const categories = ['法規', '實務', '其他'];
      categorySelect.innerHTML = `<option value="all">全部</option>`;
      categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = `${cat}.txt`;
        option.textContent = cat;
        categorySelect.appendChild(option);
      });
      // 預設選中'全部'
      categorySelect.value = 'all';
    }
  
    function setupEventListeners() {
      testSelect.addEventListener('change', () => {
        populateCategorySelect();
        if (currentMode === 'reading') {
          startMode('reading');
        }
      });

      categorySelect.addEventListener('change', () => {
        if (currentMode === 'reading') {
          startMode('reading');
        }
      });

      startReadingBtn.addEventListener('click', () => startMode('reading'));
      startTestBtn.addEventListener('click', () => startMode('test'));
      reviewMistakesBtn.addEventListener('click', () => startMode('review_incorrect'));
      reviewMarkedBtn.addEventListener('click', () => startMode('review_marked'));
    exportRecordsBtn.addEventListener('click', exportRecords);
    importRecordsBtn.addEventListener('click', importRecords);

      prevBtn.addEventListener('click', showPreviousQuestion);
      nextBtn.addEventListener('click', showNextQuestion);
      markBtn.addEventListener('click', toggleMarkCurrentQuestion);

      if (deleteMistakeBtn) {
        deleteMistakeBtn.addEventListener('click', () => {
          if (currentMode !== 'review_incorrect') return;
          const q = allQuestions[currentQuestionIndex];
          if (!q) return;
          const key = getQuestionKey(q);
          delete incorrectMistakes[key];
          saveIncorrectMistakesToStorage();
          updateReviewMistakesButtonState();

          // 從更新後的錯題紀錄重新建立顯示列表，確保資料同步
          allQuestions = Object.values(incorrectMistakes);

          if (allQuestions.length === 0) {
            alert('已無錯題，返回主選單');
            backToMenu();
          } else {
            // 如果刪除的是最後一題，將索引指回新的最後一題
            if (currentQuestionIndex >= allQuestions.length) {
              currentQuestionIndex = allQuestions.length - 1;
            }
            // 顯示當前索引的題目（可能是下一題，或新的最後一題）
            displayQuestion();
          }
        });
      }

      showAnswerBtn.addEventListener('click', () => {
        answerSection.classList.toggle('d-none');
        showAnswerBtn.textContent = answerSection.classList.contains('d-none') ? '顯示答案' : '隱藏答案';
        const labels = optionsContainer.querySelectorAll('label.option-btn');
        labels.forEach(lb => {
          lb.classList.remove('correct', 'incorrect', 'btn-success', 'btn-danger', 'btn-primary', 'text-white');
          lb.classList.add('btn-outline-primary');
        });
      });

      // 「結束測驗」/「返回主選單」按鈕的統一事件處理
      endTestBtn.addEventListener('click', () => {
        if (currentMode === 'test') {
          finishTest();
        } else {
          backToMenu();
        }
      });

      // 結果頁面「複習錯題」按鈕
      const reviewIncorrectBtn = document.getElementById('reviewIncorrectBtn');
      if (reviewIncorrectBtn) {
        reviewIncorrectBtn.addEventListener('click', () => startMode('review_incorrect'));
      }

      // 結果頁面「返回主選單」按鈕
      const backToMenuBtn = document.getElementById('backToMenu');
      if (backToMenuBtn) {
        backToMenuBtn.addEventListener('click', backToMenu);
      }

      // --- 設定事件監聽器 ---
      themeSwitch.addEventListener('change', (e) => {
        const theme = e.target.checked ? 'dark' : 'light';
        applyTheme(theme);
        localStorage.setItem('gpl_theme', theme);
      });

      fontSizeIncreaseBtn.addEventListener('click', () => {
        applyFontSize('large');
        localStorage.setItem('gpl_fontSize', 'large');
      });

      fontSizeDecreaseBtn.addEventListener('click', () => {
        applyFontSize('small');
        localStorage.setItem('gpl_fontSize', 'small');
      });

      fontSizeResetBtn.addEventListener('click', () => {
        applyFontSize('normal');
        localStorage.setItem('gpl_fontSize', 'normal');
      });

  }

  async function loadQuestions(test, category) {
    allQuestions = [];
    const testsToLoad = test === 'all' ? Array.from({ length: 10 }, (_, i) => `測驗${i + 1}`) : [test];
    const filesToLoad = category === 'all' ? ['法規.txt', '實務.txt', '其他.txt'] : [category];

    for (const currentTest of testsToLoad) {
        for (const currentFile of filesToLoad) {
            try {
                const res = await fetch(`data/${currentTest}/${currentFile}`);
                if (!res.ok) continue;
                const txt = await res.text();
                const parsed = parseTxt(txt);
                parsed.forEach(q => {
                    q.source = `${currentTest}/${currentFile}`;
                });
                allQuestions = allQuestions.concat(parsed);
            } catch (e) {
                console.warn(`讀取 ${currentTest}/${currentFile} 發生錯誤：`, e);
            }
        }
    }
  }

  function parseTxt(txt) {
    const lines = txt.split(/\r?\n/);
    const questions = [];
    const answers = {};
    const answerStart = lines.findIndex(line => line.trim().match(/^[0-9 ]{2,}\./));
    const questionLines = answerStart !== -1 ? lines.slice(0, answerStart) : lines;
    const answerLines = answerStart !== -1 ? lines.slice(answerStart) : [];

    // 解析答案
    const answerText = answerLines.join(' ');
    const matches = answerText.match(/(\d+)\.\s*([A-Z0-9OXox]+)/g) || [];
    matches.forEach(m => {
      const parts = m.match(/(\d+)\.\s*([A-Z0-9OXox]+)/);
      if (parts) answers[parseInt(parts[1])] = parts[2].toUpperCase();
    });

    // 解析題目與選項
    let currentQ = null;
    for (const line of questionLines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('[')) {
        if (currentQ) questions.push(currentQ);
        const match = trimmed.match(/\[(\d+)]\s*(.*)/);
        if (match) {
          currentQ = {
            id: parseInt(match[1]),
            question: match[2],
            options: [],
            answer: answers[parseInt(match[1])] || '',
            type: 'choice',
            marked: false,
          };
        }
      } else if (currentQ && /^[A-D1-4]\./.test(trimmed)) {
        currentQ.options.push(trimmed);
      }
    }
    if (currentQ) questions.push(currentQ);

    // 判斷是否為是非題，並設定 type 與答案格式
    questions.forEach(q => {
      if (
        q.options.length === 2 &&
        q.options[0].toUpperCase().includes('O') &&
        q.options[1].toUpperCase().includes('X')
      ) {
        q.type = 'tf';
        // 強制選項格式為固定兩項
        q.options = ['1. O', '2. X'];
        // 將答案轉為 '1' 或 '2'
        if (q.answer === 'O') q.answer = '1';
        else if (q.answer === 'X') q.answer = '2';
      }
    });

    return questions;
  }

  async function startMode(mode) {
    const questionCardBody = document.querySelector('#questionContainer .card-body');
    
    // 移除舊的模式 class
    questionCardBody.classList.remove('mode-reading', 'mode-test', 'mode-review', 'mode-review-marked');

    // 根據模式添加新的 class
    if (mode === 'reading') {
        questionCardBody.classList.add('mode-reading');
    } else if (mode === 'test') {
        questionCardBody.classList.add('mode-test');
    } else if (mode === 'review_incorrect') {
        questionCardBody.classList.add('mode-review');
    } else if (mode === 'review_marked') {
        questionCardBody.classList.add('mode-review-marked');
    }

    currentMode = mode;
    currentQuestionIndex = 0;
    userAnswers = {};
    score = 0;
  
    if (mode === 'review_incorrect' || mode === 'review_marked') {
      let questionsToShow = [];
      if (mode === 'review_incorrect') {
        loadIncorrectMistakesFromStorage();
        questionsToShow = Object.values(incorrectMistakes);
        if (questionsToShow.length === 0) {
          alert('沒有錯題可供複習。');
          return;
        }
        modeIndicator.textContent = '錯題複習';
      } else { // review_marked
        questionsToShow = loadMarkedQuestionsFromStorage();
        if (questionsToShow.length === 0) {
          alert('沒有已標記的題目可供複習。');
          return;
        }
      }
      allQuestions = questionsToShow;
      applyMarkedStatus();

      // 顯示問題容器，隱藏主選單
      welcomeScreen.classList.add('d-none');
      questionContainer.classList.remove('d-none');
      testResultContainer.classList.add('d-none');

      setupReviewMode();
      displayQuestion();
      return;
    }

    const selectedTest = testSelect.value;
    const selectedCategory = categorySelect.value;

    if (!selectedTest || !selectedCategory) {
      alert('請先選擇測驗和類別！');
      return;
    }

    try {
      await loadQuestions(selectedTest, selectedCategory);
      applyMarkedStatus();
      if (allQuestions.length === 0) {
        alert('題庫載入失敗或為空，請檢查檔案。');
        return;
      }

      welcomeScreen.classList.add('d-none');
      questionContainer.classList.remove('d-none');
      testResultContainer.classList.add('d-none');

      if (mode === 'reading') setupReadingMode();
      else if (mode === 'test') setupTestMode();

      displayQuestion();
    } catch (error) {
      console.error('載入題目時發生錯誤:', error);
      alert('載入題庫時發生錯誤，請檢查主控台以獲取詳細資訊。');
    }
  }

  function setupReadingMode() {
    timerDisplay.parentElement.classList.add('d-none');
    endTestBtn.classList.add('d-none');
    showAnswerBtn.classList.add('d-none');
    answerSection.classList.remove('d-none');
    markBtn.classList.remove('d-none'); // 確保標記按鈕可見
  }

// --- 測驗模式設定 ---
function setupTestMode() {
    // 打亂題目順序
    allQuestions.sort(() => Math.random() - 0.5);
  
    // 讀取題數限制
    const maxCountInput = document.getElementById('questionCount');
    let maxCount = parseInt(maxCountInput.value, 10);
    if (isNaN(maxCount) || maxCount <= 0 || maxCount > allQuestions.length) {
      maxCount = allQuestions.length; // 0或超過題庫數量時，使用全部題目
    }
    allQuestions = allQuestions.slice(0, maxCount);
  
    // 初始化狀態
    score = 0;
    userAnswers = {};
    currentQuestionIndex = 0;
  
    // 顯示計時器區塊
    timerDisplay.parentElement.classList.remove('d-none');
    endTestBtn.classList.remove('d-none');
  
    // 測驗時不顯示標記按鈕
    markBtn.classList.add('d-none');
  
    // 初始化累計時間
    timeLeft = 0;
    updateTimerDisplay();
  
    // 啟動累計計時器（非倒數）
    clearInterval(timer);
    timer = setInterval(() => {
      timeLeft++;
      updateTimerDisplay();
    }, 1000);
  }

  function setupReviewMode() {
    timerDisplay.parentElement.classList.add('d-none');
    endTestBtn.classList.add('d-none');
    showAnswerBtn.classList.add('d-none');
    answerSection.classList.remove('d-none');
    markBtn.classList.remove('d-none'); // 確保標記按鈕可見
  }

  function updateOptionStyles(selectedLabel) {
    const labels = optionsContainer.querySelectorAll('label.option-btn');
    labels.forEach(label => {
      label.classList.remove('btn-primary', 'text-white');
      label.classList.add('btn-outline-primary');
    });
    if (selectedLabel) {
      selectedLabel.classList.remove('btn-outline-primary');
      selectedLabel.classList.add('btn-primary', 'text-white');
    }
  }

  function displayQuestion() {
    const q = allQuestions[currentQuestionIndex];
    if (!q) return;

    // Clear previous content and prepare title
    questionNumber.innerHTML = '';
    let sourceText = '';
    if (q.source) {
        try {
            const [testName, categoryFile] = q.source.split('/');
            const categoryName = categoryFile.replace('.txt', '');
            sourceText = ` (來源: ${testName} - ${categoryName})`;
        } catch (e) {
            console.warn("Could not parse question source:", q.source);
        }
    }
    const fullQuestionTitle = `題目 #${q.id}${sourceText}`;

    // In review modes, make the title a link to the original question
    if ((currentMode === 'review_incorrect' || currentMode === 'review_marked') && q.source) {
        const link = document.createElement('a');
        link.href = '#';
        link.textContent = fullQuestionTitle;
        link.title = '點擊回到閱讀模式查看此題'; // Tooltip for UX
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            const [test, categoryFile] = q.source.split('/');

            // Set dropdowns to match the question's source
            testSelect.value = test;
            populateCategorySelect(); // Update category dropdown based on new test selection
            categorySelect.value = categoryFile;

            // Switch to reading mode. This is async.
            startMode('reading').then(() => {
                // After the new question set is loaded, find the index of our target question
                const targetIndex = allQuestions.findIndex(question => getQuestionKey(question) === getQuestionKey(q));
                if (targetIndex !== -1) {
                    currentQuestionIndex = targetIndex;
                    displayQuestion(); // Re-render to show the correct question
                }
            });
        });
        questionNumber.appendChild(link);
    } else {
        // For other modes, just display the text
        questionNumber.textContent = fullQuestionTitle;
    }
    questionText.innerHTML = q.question;
    optionsContainer.innerHTML = '';
    progressText.textContent = `${currentQuestionIndex + 1} / ${allQuestions.length}`;
    modeIndicator.textContent = {
      'reading': '閱讀模式',
      'test': '測驗模式',
      'review_incorrect': '錯題複習',
      'review_marked': '複習標記'
    }[currentMode] || '';
    // 顯示選項
    const userAnswer = userAnswers[q.id] || '';
    q.options.forEach((opt, idx) => {
        const label = document.createElement('label');
        label.classList.add('option-btn', 'btn', 'btn-outline-primary', 'mb-4', 'd-flex');
      
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'option';
        input.value = (idx + 1).toString();
        input.classList.add('me-4');
        input.disabled = currentMode.startsWith('review');
        if (userAnswer === input.value) input.checked = true;
      
        input.addEventListener('change', () => {
          if (currentMode === 'test') {
            userAnswers[q.id] = input.value;
            updateOptionStyles(label);
          } else if (currentMode === 'reading') {
            // Reset styles on all labels first
            const labels = optionsContainer.querySelectorAll('label.option-btn');
            labels.forEach(lb => {
              lb.classList.remove('correct', 'incorrect', 'btn-success', 'btn-danger', 'btn-primary', 'text-white');
              lb.classList.add('btn-outline-primary');
            });

            // Apply feedback based on correctness
            label.classList.remove('btn-outline-primary');
            if (input.value === q.answer) {
              label.classList.add('correct');
            } else {
              label.classList.add('incorrect');
            }
            answerSection.classList.remove('d-none');
            showAnswerBtn.textContent = answerSection.classList.contains('d-none') ? '顯示答案' : '隱藏答案';
          }
        });
      
        // Wrap the option text in a span
        const optSpan = document.createElement('span');
        optSpan.textContent = opt;
        label.appendChild(input);
        label.appendChild(optSpan);
        optionsContainer.appendChild(label);
      });
      
    if (currentMode === 'test') {
        const selectedValue = userAnswers[q.id];
        if (selectedValue) {
            const selectedInput = optionsContainer.querySelector(`input[value="${selectedValue}"]`);
            if (selectedInput) {
                updateOptionStyles(selectedInput.parentElement);
            }
        } else {
            updateOptionStyles(null);
        }
    }
    // 顯示答案區塊
    correctAnswerSpan.textContent = q.type === 'tf' ? (q.answer === '1' ? 'O' : 'X') : q.answer;

    if (currentMode === 'review_incorrect' || currentMode === 'review_marked') {
      if (currentMode === 'review_incorrect') deleteMistakeBtn.classList.remove('d-none');
      else deleteMistakeBtn.classList.add('d-none');
        answerSection.classList.remove('d-none');
        showAnswerBtn.classList.add('d-none');
    } else if (currentMode === 'reading') {
      deleteMistakeBtn.classList.add('d-none');
        answerSection.classList.add('d-none');
        showAnswerBtn.classList.remove('d-none');
    } else { // Test mode
        deleteMistakeBtn.classList.add('d-none');
        answerSection.classList.add('d-none');
        showAnswerBtn.classList.add('d-none');
    }

    updateMarkButton();
    updateNavigationButtons();
  }

  function startTimer() {
    const questionCount = parseInt(document.getElementById('questionCount').value, 10) || allQuestions.length;
    timeLeft = questionCount * 60; // 每題60秒
    clearInterval(timer);
    timer = setInterval(() => {
      timeLeft--;
      updateTimerDisplay();
      if (timeLeft <= 0) {
        finishTest();
      }
    }, 1000);
  }

    // 計時器顯示為累計時間（分鐘:秒）
    function updateTimerDisplay() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    // 結束測驗，計算分數並顯示結果
    function finishTest() {
        clearInterval(timer);
      
        score = 0;
        loadIncorrectMistakesFromStorage(); // 首先載入所有歷史錯題

        allQuestions.forEach(q => {
          const userAnswer = userAnswers[q.id];
          const key = getQuestionKey(q);
          let isCorrect = false;

          if (q.type === 'tf') {
            if (userAnswer === q.answer) {
              isCorrect = true;
            }
          } else {
            if (userAnswer && q.answer && userAnswer.toUpperCase() === q.answer.toUpperCase()) {
              isCorrect = true;
            }
          }

          if (isCorrect) {
            score++;
            // 如果答對了，且該題存在於錯題紀錄中，則將其移除
            if (incorrectMistakes[key]) {
              delete incorrectMistakes[key];
            }
          } else {
            // 如果答錯了，就(新)增至錯題紀錄
            incorrectMistakes[key] = q;
          }
        });

        saveIncorrectMistakesToStorage(); // 將更新後的完整錯題紀錄存回 localStorage
      
        // 顯示結果區
        questionContainer.classList.add('d-none');
        testResultContainer.classList.remove('d-none');
      
        // 更新結果顯示
        const scoreSpan = document.getElementById('score');
        const totalQuestionsSpan = document.getElementById('totalQuestions');
        const scoreProgress = document.getElementById('scoreProgress');
        const incorrectList = document.getElementById('incorrectList');
      
        scoreSpan.textContent = score;
        totalQuestionsSpan.textContent = allQuestions.length;
      
        const percent = Math.floor((score / allQuestions.length) * 100);
        scoreProgress.style.width = `${percent}%`;
        scoreProgress.textContent = `${percent}%`;
      
        // 顯示錯誤題目清單
        incorrectList.innerHTML = '';
        Object.values(incorrectMistakes).forEach(q => {
          const key = getQuestionKey(q);
          const userAnswer = userAnswers[key.split('|')[1]];
          const correctAnswer = q.answer;

          const userAnswertText = getOptionText(q, userAnswer);
          const correctAnswerText = getOptionText(q, correctAnswer);

          const li = document.createElement('li');
          li.classList.add('list-group-item');
          
          li.innerHTML = `
            <p class="mb-1">題目 #${q.id}: ${q.question}</p>
            <p class="mb-1 text-success fw-bold">
                正確答案： ${correctAnswerText}
            </p>
            <p class="mb-0 text-danger fw-bold">
                您的答案： ${userAnswertText}
            </p>
          `;
          incorrectList.appendChild(li);
        });
      
        updateReviewMistakesButtonState(); // 更新左側複習錯題按鈕狀態
      }

      
  function showPreviousQuestion() {
    if (currentQuestionIndex > 0) {
      currentQuestionIndex--;
      displayQuestion();
    }
  }

  function showNextQuestion() {
    if (currentQuestionIndex < allQuestions.length - 1) {
      currentQuestionIndex++;
      displayQuestion();
    }
  }

  function updateNavigationButtons() {
    prevBtn.disabled = currentQuestionIndex === 0;
    nextBtn.disabled = currentQuestionIndex === allQuestions.length - 1;
  }
  function toggleMarkCurrentQuestion() {
    const q = allQuestions[currentQuestionIndex];
    if (!q) return;

    q.marked = !q.marked;
    updateMarkButton();
    saveMarkedQuestionsToStorage();
  }

  function updateMarkButton() {
    const q = allQuestions[currentQuestionIndex];
    if (!q) return;

    if (q.marked) {
      markBtn.classList.add('btn-danger');
      markBtn.classList.remove('btn-outline-danger');
      markBtn.textContent = '已標記';
    } else {
      markBtn.classList.remove('btn-danger');
      markBtn.classList.add('btn-outline-danger');
      markBtn.textContent = '標記';
    }
  }

  function saveIncorrectMistakesToStorage() {
    // 直接用當前的錯題狀態覆蓋localStorage
    localStorage.setItem('gpl_incorrect_mistakes', JSON.stringify(incorrectMistakes));
  }

  function loadIncorrectMistakesFromStorage() {
    const saved = localStorage.getItem('gpl_incorrect_mistakes');
    if (saved) {
      incorrectMistakes = JSON.parse(saved);
    }
  }

  function saveMarkedQuestionsToStorage() {
    // 讀取所有已存儲的標記問題
    const storedMarked = loadMarkedQuestionsFromStorage();
    const markedMap = new Map(storedMarked.map(q => [getQuestionKey(q), q]));

    // 根據當前題目列表 (allQuestions) 的狀態更新 Map
    allQuestions.forEach(q => {
      const key = getQuestionKey(q);
      if (q.marked) {
        // 如果題目被標記，則在 Map 中新增或更新
        markedMap.set(key, q);
      } else {
        // 如果題目取消標記，則從 Map 中移除
        markedMap.delete(key);
      }
    });

    // 將更新後的 Map 轉換為陣列並存回 localStorage
    const newMarkedList = Array.from(markedMap.values());
    localStorage.setItem('gpl_marked_questions', JSON.stringify(newMarkedList));
    updateReviewMarkedButtonState();
  }

  function loadMarkedQuestionsFromStorage() {
    const saved = localStorage.getItem('gpl_marked_questions');
    return saved ? JSON.parse(saved) : [];
  }

  function updateReviewMistakesButtonState() {
    reviewMistakesBtn.disabled = Object.keys(incorrectMistakes).length === 0;
  }

  function updateReviewMarkedButtonState() {
    const marked = loadMarkedQuestionsFromStorage();
    reviewMarkedBtn.disabled = marked.length === 0;
  }
  function backToMenu() {
    currentMode = '';
    welcomeScreen.classList.remove('d-none');
    questionContainer.classList.add('d-none');
    testResultContainer.classList.add('d-none');
    timerDisplay.parentElement.classList.add('d-none');
    endTestBtn.classList.add('d-none');
    clearInterval(timer);
  }
  
  // --- 設定函式 ---
  function applyTheme(theme) {
    if (theme === 'dark') {
      document.body.setAttribute('data-theme', 'dark');
      themeSwitch.checked = true;
    } else {
      document.body.removeAttribute('data-theme');
      themeSwitch.checked = false;
    }
  }

  function applyFontSize(size) {
    document.body.classList.remove('font-size-small', 'font-size-normal', 'font-size-large');
    document.body.classList.add(`font-size-${size}`);
  }

  function loadSettings() {
    // 載入主題
    const savedTheme = localStorage.getItem('gpl_theme') || 'light';
    applyTheme(savedTheme);

    // 載入字體大小
    const savedFontSize = localStorage.getItem('gpl_fontSize') || 'normal';
    applyFontSize(savedFontSize);
  }

  // --- 匯出/匯入功能 ---
  function exportRecords() {
    try {
      const records = {
        incorrectMistakes: JSON.parse(localStorage.getItem('gpl_incorrect_mistakes') || '{}'),
        markedQuestions: JSON.parse(localStorage.getItem('gpl_marked_questions') || '[]'),
      };

      const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `gpl-mock-test-backup-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert('紀錄已成功匯出！');
    } catch (error) {
      console.error('匯出失敗:', error);
      alert('匯出紀錄時發生錯誤。');
    }
  }

  function importRecords() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = event => {
        try {
          const records = JSON.parse(event.target.result);
          if (records && records.incorrectMistakes && records.markedQuestions) {
            // 合併而不是覆蓋
            const existingMistakes = JSON.parse(localStorage.getItem('gpl_incorrect_mistakes') || '{}');
            const existingMarked = JSON.parse(localStorage.getItem('gpl_marked_questions') || '[]');

            const mergedMistakes = { ...existingMistakes, ...records.incorrectMistakes };
            
            const markedMap = new Map(existingMarked.map(q => [getQuestionKey(q), q]));
            records.markedQuestions.forEach(q => markedMap.set(getQuestionKey(q), q));
            const mergedMarked = Array.from(markedMap.values());

            localStorage.setItem('gpl_incorrect_mistakes', JSON.stringify(mergedMistakes));
            localStorage.setItem('gpl_marked_questions', JSON.stringify(mergedMarked));

            // 重新載入狀態並更新UI
            loadIncorrectMistakesFromStorage();
            applyMarkedStatus();
            updateReviewMistakesButtonState();
            updateReviewMarkedButtonState();

            alert('紀錄已成功匯入並合併！');
          } else {
            alert('檔案格式不符，匯入失敗。');
          }
        } catch (error) {
          console.error('匯入失敗:', error);
          alert('讀取或解析檔案時發生錯誤。');
        }
      };
      reader.readAsText(file);
    };

    input.click();
  }

  // 啟動初始化
  initialize();
  // 設置初值
  document.documentElement.style.zoom = '67%';
});
  