package com.littlesteps.recovery

import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import android.app.AlertDialog
import android.graphics.Color
import android.os.Bundle
import android.webkit.JsResult
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import java.io.ByteArrayInputStream

/**
 * Hosts only bundled recovery screens. No network permission or JavaScript bridge
 * is needed; the existing engine and storage remain the source of truth.
 */
class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val container = FrameLayout(this).apply {
            setBackgroundColor(Color.rgb(16, 57, 47))
            setOnApplyWindowInsetsListener { view, insets ->
                view.setPadding(
                    insets.systemWindowInsetLeft, insets.systemWindowInsetTop,
                    insets.systemWindowInsetRight, insets.systemWindowInsetBottom
                )
                insets.consumeSystemWindowInsets()
            }
        }
        webView = WebView(this).apply {
            setBackgroundColor(Color.rgb(248, 250, 247))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                    request.url.toString() != HOME

                override fun shouldInterceptRequest(
                    view: WebView, request: WebResourceRequest
                ): WebResourceResponse {
                    val uri = request.url
                    val name = uri.path?.removePrefix("/").orEmpty()
                    if (uri.scheme != "https" || uri.host != HOST ||
                        name !in ASSETS || request.method != "GET") return unavailable()
                    return try {
                        val mime = when (name.substringAfterLast('.')) {
                            "html" -> "text/html"
                            "js" -> "text/javascript"
                            "css" -> "text/css"
                            "svg" -> "image/svg+xml"
                            "png" -> "image/png"
                            else -> "application/manifest+json"
                        }
                        WebResourceResponse(mime, "UTF-8", assets.open(name))
                    } catch (_: java.io.IOException) {
                        unavailable()
                    }
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onJsConfirm(view: WebView, url: String, message: String, result: JsResult): Boolean {
                    AlertDialog.Builder(this@MainActivity)
                        .setMessage(message)
                        .setPositiveButton("Delete") { _, _ -> result.confirm() }
                        .setNegativeButton("Cancel") { _, _ -> result.cancel() }
                        .setOnCancelListener { result.cancel() }
                        .show()
                    return true
                }
            }
        }
        container.addView(webView, FrameLayout.LayoutParams(-1, -1))
        setContentView(container)
        container.requestApplyInsets()
        // Reload after rotation/process recreation; the session is in DOM storage.
        webView.loadUrl(HOME)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() { handleBack() }
        })
    }

    private fun handleBack() {
        webView.evaluateJavascript(
            """(() => {
                const entry = document.getElementById('entry');
                const emergency = document.getElementById('emergency');
                if (emergency?.open) return true;
                if (entry?.open) { entry.close(); return true; }
                return false;
            })()"""
        ) { handled -> if (handled != "true") finish() }
    }

    override fun onPause() { webView.onPause(); super.onPause() }
    override fun onResume() { super.onResume(); if (::webView.isInitialized) webView.onResume() }
    override fun onDestroy() {
        (webView.parent as? FrameLayout)?.removeView(webView)
        webView.destroy()
        super.onDestroy()
    }

    private fun unavailable() = WebResourceResponse(
        "text/plain", "UTF-8", 404, "Not Found", emptyMap(),
        ByteArrayInputStream(ByteArray(0))
    )

    companion object {
        private const val HOST = "appassets.androidplatform.net"
        private const val HOME = "https://$HOST/index.html"
        private val ASSETS = setOf(
            "index.html", "app.js", "engine.js", "style.css", "icon.svg",
            "icon-192.png", "icon-512.png", "app.webmanifest"
        )
    }
}
