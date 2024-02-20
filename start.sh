#!/bin/bash

# Start Gunicorn processes
echo Starting Gunicorn.
exec gunicorn qlever.wsgi:application \
    --bind 0.0.0.0:7000 \
    --workers 5
