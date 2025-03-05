document.getElementById('numbers').addEventListener('input', () => {
    const numbers = document.getElementById('numbers').value
        .split(/[\n,]+/)
        .map(num => num.trim().replace(/[^0-9+]/g, ''))
        .filter(num => num.length > 0);
    document.getElementById('numberCount').innerText = `Total Numbers: ${numbers.length}`;
});

const logContainer = document.getElementById('status');
const timeRemainingEl = document.getElementById('timeRemaining');

function logMessage(text) {
    let logEntry = document.createElement('div');
    logEntry.textContent = text;
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// Ensure the event listener is added only once
chrome.runtime.onMessage.addListener((request) => {
    if (request.log) {
        logMessage(request.log);
    }
});

document.getElementById('start').addEventListener('click', async () => {
    const numbers = document.getElementById('numbers').value
        .split(/[\n,]+/)
        .map(num => num.trim().replace(/[^0-9+]/g, ''))
        .filter(num => num.length > 0);
    const message = encodeURIComponent(document.getElementById('message').value.trim());

    if (numbers.length === 0 || !message) {
        alert("❌ Please enter at least one phone number and a message.");
        return;
    }

    let sentCount = 0;
    const totalCount = numbers.length;
    const estimatedTimePerMessage = 8; // In seconds (adjust as needed)
    let totalRemainingTime = totalCount * estimatedTimePerMessage;

    function updateRemainingTime() {
        const hours = String(Math.floor(totalRemainingTime / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((totalRemainingTime % 3600) / 60)).padStart(2, '0');
        const seconds = String(totalRemainingTime % 60).padStart(2, '0');
        timeRemainingEl.textContent = `${hours}:${minutes}:${seconds}`;
    }

    updateRemainingTime();
    document.getElementById('progress').firstElementChild.innerText = `Sent: ${sentCount} | Remaining: ${totalCount - sentCount}`;

    const timerInterval = setInterval(() => {
        if (totalRemainingTime > 0) {
            totalRemainingTime--;
            updateRemainingTime();
        } else {
            clearInterval(timerInterval);
        }
    }, 1000);

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs.length === 0) {
            logMessage("❌ No active tab found!");
            return;
        }

        let tabId = tabs[0].id;

        for (let i = 0; i < numbers.length; i++) {
            const number = numbers[i];
            let whatsappURL = `https://web.whatsapp.com/send?phone=${number}&text=${message}`;

            logMessage(`⏳ Opening chat for: ${number}...`);
            chrome.tabs.update(tabId, { url: whatsappURL });

            await new Promise(resolve => setTimeout(resolve, 7000)); // Reduced from 8 sec to 5 sec

            // Execute content script once per message
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                args: [decodeURIComponent(message)],
                func: async (message) => {
                    if (window.scriptAlreadyExecuted) return;
                    window.scriptAlreadyExecuted = true;

                    function sendLogToPopup(text) {
                        chrome.runtime.sendMessage({ log: text });
                    }

                    sendLogToPopup("⏳ Waiting for WhatsApp chat to load...");

                    let retries = 10;
                    let messageInput;
                    while (retries > 0) {
                        messageInput = document.querySelector('div[contenteditable="true"][aria-label="Type a message"]');
                        if (messageInput) break;
                        await new Promise(r => setTimeout(r, 400)); // Reduced interval
                        retries--;
                    }

                    if (!messageInput) {
                        sendLogToPopup("❌ Message input box not found!");
                        return;
                    }

                    sendLogToPopup("✅ Chat loaded. Typing message...");
                    messageInput.innerHTML = "";
                    messageInput.focus();
                    document.execCommand("insertText", false, message);
                    await new Promise(r => setTimeout(r, 800)); // Reduced from 1 sec to 0.8 sec

                    sendLogToPopup("✅ Message typed. Sending...");

                    messageInput.dispatchEvent(new KeyboardEvent('keydown', {
                        key: 'Enter',
                        code: 'Enter',
                        keyCode: 13,
                        which: 13,
                        bubbles: true
                    }));

                    await new Promise(r => setTimeout(r, 1000)); // Wait 1 sec to confirm sent

                    sendLogToPopup(`✅ Message sent to ${window.location.href}`);
                }
            });

            sentCount++;
            document.getElementById('progress').firstElementChild.innerText = `Sent: ${sentCount} | Remaining: ${totalCount - sentCount}`;
            updateRemainingTime();

            if (i < numbers.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 5000)); // Reduced from 5 sec to 3 sec
            }
        }

        clearInterval(timerInterval);
        timeRemainingEl.textContent = "00:00:00";
        logMessage("🎉 ✅ All messages sent!");
    });
});
