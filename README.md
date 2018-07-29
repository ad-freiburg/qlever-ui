# QLeverUI
A user interface for QLever (https://github.com/ad-freiburg/QLever)

## Notes
You'll need access to a running QLever instance in order to use QLever UI

## Setup

- Pull this repository
- Create a virtualenvironment or install pip (2.7)
- Run ```pip install -r requirements.txt```
- Change "settings_secret_template.py" to "settings_secret" and fill in the gaps
- Run ```python manage.py migrate```
- Run ```python manage.py createsuperuser``` and follow the instructions
- Run ```python manage.py runserver```
- Open http://localhost:8000/ in your browser and see if it works
- Go to http://localhost:8000/admin/login/ and login with our credentials
- Go to 'Backends' -> 'Add Backend' and add the details of your QLever instance
