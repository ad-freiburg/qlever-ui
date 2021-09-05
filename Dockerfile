FROM python:3.8.1-alpine3.11

ADD requirements.txt /app/requirements.txt

RUN set -ex \
    && python -m venv /env \
    && /env/bin/pip install --upgrade pip \
    && /env/bin/pip install --no-cache-dir -r /app/requirements.txt \
    && runDeps="$(scanelf --needed --nobanner --recursive /env \
    | awk '{ gsub(/,/, "\nso:", $2); print "so:" $2 }' \
    | sort -u \
    | xargs -r apk info --installed \
    | sort -u)" \
    && apk add --virtual rundeps $runDeps \
    && apk add bash

ADD . /app
WORKDIR /app

ENV VIRTUAL_ENV /env
ENV PATH /env/bin:$PATH
ENV PYTHONUNBUFFERED 1

EXPOSE 8000

CMD ["gunicorn", "--bind", ":8000", "--workers", "3", "qlever.wsgi:application"]
