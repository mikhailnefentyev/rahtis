<?xml version="1.0" encoding="UTF-8"?>
<!--
  Оформление карты сайта для человека в браузере. Роботы его не читают.

  Без него Chrome показывал карту одной строкой: в ней есть элементы из
  пространства имён XHTML (ссылки на переводы, xhtml:link), и браузер
  рисует такой файл как страницу, а не как дерево XML.
-->
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <meta name="robots" content="noindex"/>
        <title>RAHTIS · sitemap</title>
        <style>
          body { margin: 0; padding: 24px 16px; font: 14px/1.5 system-ui, sans-serif; color: #14202b; background: #f4f6f8; }
          h1 { font-size: 18px; margin: 0 0 4px; }
          p { margin: 0 0 16px; color: #5b6b78; }
          table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #dde3e8; }
          th, td { padding: 8px 10px; border-bottom: 1px solid #edf0f3; text-align: left; vertical-align: top; }
          th { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: #5b6b78; background: #fafbfc; }
          a { color: #0e6a80; text-decoration: none; }
          .langs a { display: inline-block; margin: 0 6px 2px 0; font: 12px ui-monospace, monospace; }
          .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
        </style>
      </head>
      <body>
        <h1>RAHTIS · sitemap</h1>
        <p><xsl:value-of select="count(s:urlset/s:url)"/> URLs</p>
        <table>
          <tr><th>URL</th><th>Languages</th><th>Last modified</th><th>Priority</th></tr>
          <xsl:for-each select="s:urlset/s:url">
            <tr>
              <td><a href="{s:loc}"><xsl:value-of select="s:loc"/></a></td>
              <td class="langs">
                <xsl:for-each select="xhtml:link">
                  <a href="{@href}"><xsl:value-of select="@hreflang"/></a>
                </xsl:for-each>
              </td>
              <td class="num"><xsl:value-of select="s:lastmod"/></td>
              <td class="num"><xsl:value-of select="s:priority"/></td>
            </tr>
          </xsl:for-each>
        </table>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
