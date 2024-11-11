FROM index.docker.io/library/python:3.12.4-alpine3.20


COPY . /app
WORKDIR /app

# install python deps
RUN set -ex \
    && python -m venv /env \
    && /env/bin/pip install --upgrade pip \
    && /env/bin/pip install --no-cache-dir -r /app/requirements.txt

RUN set -ex \
    && runDeps="$(scanelf --needed --nobanner --recursive /env \
    | awk '{ gsub(/,/, "\nso:", $2); print "so:" $2 }' \
    | sort -u \
    | xargs -r apk info --installed \
    | sort -u)" \
    && apk add --virtual rundeps $runDeps \
    && apk add bash bash-completion make sqlite nodejs npm

# install js deps
RUN npm ci
RUN npm run build

ENV VIRTUAL_ENV="/env"
ENV PATH="/env/bin:${PATH}"
ENV PYTHONUNBUFFERED="1"

# Collect static resources
RUN ./manage.py collectstatic

CMD [ "gunicorn", "--bind", ":7000", "--workers", "3", "--limit-request-line", "10000", "qlever.wsgi:application" ]

# QLever UI on port 7000 for QLever instance listening on port 7001
#
# docker build -t qlever-ui .
# docker run -it --rm -p 7000:7000 qlever-ui
#
# OR simply
#
# docker run -it --rm -p 7000:7000 adfreiburg/qlever-ui
#
# To configure the QLever UI for a particular backend, in the UI: Resources ->
# Qlever UI Admin -> Login (demo, demo) -> Backends
