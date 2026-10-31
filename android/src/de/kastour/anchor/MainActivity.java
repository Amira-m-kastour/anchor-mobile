/* ANCHOR Mobile for Android - a WebView around the same offline web app as the PWA.
   The app's files are served from the APK's assets at https://appassets.androidplatform.net/ (a secure origin, so
   IndexedDB, Web Workers and fetch to the live services work as in a browser). The bridge "AnchorAndroid" saves files
   through the system's "Save as" dialog, copies text, opens links in the browser, and hands over .anchor files opened
   from other apps. Nothing else of the device is exposed to the page. */
package de.kastour.anchor;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String BASE = "https://" + HOST + "/";
    static final int REQ_PICK = 1, REQ_SAVE = 2;
    WebView web;
    ValueCallback<Uri[]> pickCallback;
    byte[] pendingSave; String pendingSaveId;
    Uri pendingOpen; boolean pageReady = false;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#FBFAF6"));
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setTextZoom(100);
        web.addJavascriptInterface(new Bridge(), "AnchorAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (!HOST.equals(u.getHost())) return null;                          // live services go to the network
                String path = u.getPath(); if (path == null || path.equals("/")) path = "/index.html";
                try {
                    InputStream in = getAssets().open("app" + path);
                    String ext = MimeTypeMap.getFileExtensionFromUrl(path);
                    String mime = mimeFor(ext);
                    WebResourceResponse r = new WebResourceResponse(mime, mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") ? "UTF-8" : null, in);
                    Map<String, String> h = new HashMap<>(); h.put("Cache-Control", "no-cache"); h.put("Access-Control-Allow-Origin", BASE.substring(0, BASE.length() - 1));
                    r.setResponseHeaders(h); return r;
                } catch (Exception e) {
                    return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", new HashMap<String, String>(), null);
                }
            }
            @SuppressWarnings("deprecation") @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                Uri u = Uri.parse(url);
                if (HOST.equals(u.getHost())) return false;
                openExternal(u.toString()); return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (pickCallback != null) pickCallback.onReceiveValue(null);
                pickCallback = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT); i.addCategory(Intent.CATEGORY_OPENABLE); i.setType("*/*");
                if (p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try { startActivityForResult(Intent.createChooser(i, null), REQ_PICK); } catch (ActivityNotFoundException e) { pickCallback = null; return false; }
                return true;
            }
        });
        pendingOpen = incomingUri(getIntent());
        if (state != null) web.restoreState(state); else web.loadUrl(BASE + "index.html");
    }

    static String mimeFor(String ext) {
        if (ext == null) return "application/octet-stream";
        switch (ext.toLowerCase()) {
            case "html": return "text/html"; case "js": return "application/javascript"; case "css": return "text/css";
            case "json": case "webmanifest": return "application/json"; case "png": return "image/png"; case "svg": return "image/svg+xml";
            case "woff2": return "font/woff2"; case "txt": case "md": return "text/plain"; default: return "application/octet-stream";
        }
    }

    Uri incomingUri(Intent i) {
        if (i == null) return null;
        if (Intent.ACTION_VIEW.equals(i.getAction())) return i.getData();
        if (Intent.ACTION_SEND.equals(i.getAction())) return (Uri) i.getParcelableExtra(Intent.EXTRA_STREAM);
        return null;
    }
    @Override protected void onNewIntent(Intent i) { super.onNewIntent(i); Uri u = incomingUri(i); if (u != null) { pendingOpen = u; if (pageReady) deliverOpen(); } }

    void deliverOpen() {
        final Uri u = pendingOpen; pendingOpen = null; if (u == null) return;
        try {
            InputStream in = getContentResolver().openInputStream(u); ByteArrayOutputStream bo = new ByteArrayOutputStream(); byte[] buf = new byte[65536]; int n;
            while ((n = in.read(buf)) > 0) bo.write(buf, 0, n); in.close();
            String name = displayName(u); final String js = "window.anchorOpenFromAndroid(" + jsStr(name) + "," + jsStr(Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP)) + ")";
            web.post(new Runnable() { public void run() { web.evaluateJavascript(js, null); } });
        } catch (Exception e) { Toast.makeText(this, "The file could not be opened: " + e.getMessage(), Toast.LENGTH_LONG).show(); }
    }
    String displayName(Uri u) {
        String n = "project.anchor";
        try (Cursor c = getContentResolver().query(u, null, null, null, null)) { if (c != null && c.moveToFirst()) { int k = c.getColumnIndex(OpenableColumns.DISPLAY_NAME); if (k >= 0) n = c.getString(k); } } catch (Exception e) { /* keep default */ }
        if (n == null) n = u.getLastPathSegment(); return n == null ? "project.anchor" : n;
    }
    static String jsStr(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (char ch : s.toCharArray()) { if (ch == '"' || ch == '\\') b.append('\\').append(ch); else if (ch < 0x20 || ch == 0x2028 || ch == 0x2029) b.append(String.format("\\u%04x", (int) ch)); else b.append(ch); }
        return b.append('"').toString();
    }
    void openExternal(String url) {
        if (!url.startsWith("https://") && !url.startsWith("http://") && !url.startsWith("mailto:")) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (ActivityNotFoundException e) { Toast.makeText(this, url, Toast.LENGTH_LONG).show(); }
    }

    class Bridge {
        @JavascriptInterface public void ready() { runOnUiThread(new Runnable() { public void run() { pageReady = true; if (pendingOpen != null) deliverOpen(); } }); }
        @JavascriptInterface public void openUrl(final String url) { runOnUiThread(new Runnable() { public void run() { openExternal(url); } }); }
        @JavascriptInterface public void copy(String text) { ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE); if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("ANCHOR", text)); }
        @JavascriptInterface public void saveFile(final String name, final String mime, String b64, final String id) {
            pendingSave = Base64.decode(b64, Base64.DEFAULT); pendingSaveId = id;
            runOnUiThread(new Runnable() { public void run() {
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT); i.addCategory(Intent.CATEGORY_OPENABLE); i.setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime); i.putExtra(Intent.EXTRA_TITLE, name);
                try { startActivityForResult(i, REQ_SAVE); } catch (ActivityNotFoundException e) { finishSave(false); }
            } });
        }
    }
    void finishSave(boolean ok) {
        final String js = "window.__anchorSaved && window.__anchorSaved[" + jsStr(pendingSaveId == null ? "" : pendingSaveId) + "] && window.__anchorSaved[" + jsStr(pendingSaveId == null ? "" : pendingSaveId) + "](" + ok + ")";
        pendingSave = null; pendingSaveId = null; web.evaluateJavascript(js, null);
    }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ_PICK) {
            if (pickCallback == null) return;
            Uri[] out = null;
            if (res == RESULT_OK && data != null) {
                if (data.getClipData() != null) { ClipData cd = data.getClipData(); out = new Uri[cd.getItemCount()]; for (int k = 0; k < out.length; k++) out[k] = cd.getItemAt(k).getUri(); }
                else if (data.getData() != null) out = new Uri[]{ data.getData() };
            }
            pickCallback.onReceiveValue(out); pickCallback = null; return;
        }
        if (req == REQ_SAVE) {
            boolean ok = false;
            if (res == RESULT_OK && data != null && data.getData() != null && pendingSave != null) {
                try (OutputStream os = getContentResolver().openOutputStream(data.getData(), "w")) { os.write(pendingSave); ok = true; }
                catch (Exception e) { Toast.makeText(this, "Saving failed: " + e.getMessage(), Toast.LENGTH_LONG).show(); }
            }
            finishSave(ok);
        }
    }
    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
}
