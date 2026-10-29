/*
 * 每次页面加载完成后注入，补齐 WKWebView 不支持的浏览器能力（与 Android bridge.js 对齐）。
 */
(function () {
    if (window.__wrongNotebookIOSReady) return;
    window.__wrongNotebookIOSReady = true;
    var bridge = window.WrongNotebookIOS;
    if (!bridge) return;

    window.print = function () {
        bridge.print();
    };

    var revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = function (url) {
        setTimeout(function () { revoke(url); }, 60000);
    };

    function save(href, name) {
        fetch(href, { credentials: 'same-origin' })
            .then(function (response) { return response.blob(); })
            .then(function (blob) {
                var reader = new FileReader();
                reader.onload = function () {
                    bridge.saveFile(String(reader.result), name || '', blob.type || '');
                };
                reader.readAsDataURL(blob);
            })
            .catch(function (error) {
                console.error('[WrongNotebookIOS] download failed', error);
            });
    }
    window.__wrongNotebookSave = save;

    function isLocalDownload(anchor) {
        return !!anchor && anchor.hasAttribute('download') && /^(blob|data):/i.test(anchor.href);
    }

    var click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
        if (isLocalDownload(this)) {
            save(this.href, this.getAttribute('download'));
            return;
        }
        return click.call(this);
    };
    document.addEventListener('click', function (event) {
        var target = event.target;
        var anchor = target && target.closest ? target.closest('a') : null;
        if (isLocalDownload(anchor)) {
            event.preventDefault();
            save(anchor.href, anchor.getAttribute('download'));
        }
    }, true);
})();
