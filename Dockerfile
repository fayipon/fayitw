# 純靜態網站：用 nginx 直接提供檔案，不需要 build 步驟
FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY *.html /usr/share/nginx/html/
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js
COPY assets /usr/share/nginx/html/assets
COPY config /usr/share/nginx/html/config

# HTML 入口與模組內的相對 import 共用版本，依賴更新也會換網址。
COPY docker/version-assets.sh /tmp/version-assets.sh
RUN sh /tmp/version-assets.sh /usr/share/nginx/html && rm /tmp/version-assets.sh

HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q --spider http://127.0.0.1/ || exit 1
