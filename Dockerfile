# 純靜態網站：用 nginx 直接提供檔案，不需要 build 步驟
FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY *.html /usr/share/nginx/html/
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js
COPY assets /usr/share/nginx/html/assets
COPY config /usr/share/nginx/html/config

# CSS / JS 網址加上內容雜湊（style.css?v=1a2b3c4d），改版後瀏覽器與 Cloudflare 不會拿到舊檔
RUN cd /usr/share/nginx/html && for f in css/*.css js/*.js; do \
      v=$(md5sum "$f" | cut -c1-8); \
      sed -i "s#\"$f\"#\"$f?v=$v\"#g" *.html; \
    done

HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q --spider http://127.0.0.1/ || exit 1
