function openFakeWindow(contentFile) {
    const width = 900;
    const height = 700;
    const left = (window.innerWidth / 2) - (width / 2);
    const top = (window.innerHeight / 2) - (height / 2);

    // Open a new window (fake window)
    const fakeWindow = window.open(contentFile, 'FakeWindow', `width=${width},height=${height},top=${top},left=${left},resizable=yes`);

    // Check if the window was blocked
    if (!fakeWindow) {
        alert('Please allow popups for this website');
    }
}