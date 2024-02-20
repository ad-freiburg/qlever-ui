FROM docker.io/python:3.12.2-alpine3.19

LABEL "org.opencontainers.image.url"="https://github.com/ad-freiburg/qlever-ui"
LABEL "org.opencontainers.image.documentation"="https://github.com/ad-freiburg/qlever-ui"
LABEL "org.opencontainers.image.source"="https://github.com/ad-freiburg/qlever-ui"
LABEL "org.opencontainers.image.licenses"="Apache-2.0"
LABEL "org.opencontainers.image.title"="QLever UI"
LABEL "org.opencontainers.image.description"="A user interface for QLever"
LABEL "org.opencontainers.image.base"="docker.io/python:3.10.2-alpine3.15"

ADD requirements.txt /app/requirements.txt

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
    && apk add bash bash-completion make sqlite

COPY . /app
# ADD . /app
WORKDIR /app

ENV VIRTUAL_ENV /env
ENV PATH /env/bin:$PATH
ENV PYTHONUNBUFFERED 1

# collect static resources
RUN ./manage.py collectstatic

CMD ["gunicorn", "--bind", ":7000", "--workers", "3", "--limit-request-line", "10000", "qlever.wsgi:application"]

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
