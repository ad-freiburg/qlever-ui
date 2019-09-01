# What is QLeverUI?
QLever UI is a simple interactive user interface for QLever (https://github.com/ad-freiburg/QLever) that helps you to discover the scopes of very large knowledge bases by providing context sensitive suggestions.

## What is QLever?
QLever (pronounced "clever") is an efficient SPARQL engine which can handle very large datasets. For example, QLever can index the complete Wikidata (~ 7 billion triples) in less than 12 hours on a standard Linux machine using around 40 GB of RAM, with subsequent query times below 1 second even for relatively complex queries with large result sets. On top of the standard SPARQL functionality, QLever also supports SPARQL+Text search and SPARQL autocompletion; these are described in the next section.

# Setup

## Requirements
- You will need access to a running QLever instance in order to use QLever UI.
- You should have Python 2.7 installed on your machine
- We recommend to use a virtual environment tool like virtualenv
 
## Installation

- Clone or download this GitHub repository
- Create a virtual environment or install pip (2.7)
- Run ```pip install -r requirements.txt``` in the project root directory
- Move "settings_secret_template.py" to "settings_secret.py" and fill in the gaps
- Run ```python manage.py migrate``` to create the databbse
- Run ```python manage.py createsuperuser``` and follow the instructions
- Run ```python manage.py runserver localhost:8042``` to start a development server
- Open http://localhost:8042/ in your browser and see if it works
- Go to http://localhost:8042/admin/login/ and login with our credentials
- Go to 'Backends' -> 'Add Backend' and add the details of your QLever instance
- You will find hints and help below each configuration field

#### Notes
- Feel free to change hostname (localhost) or port (8042) if needed
- When using in productive environments see the deployment information below

#### Further reading
- [How to deploy a django instance](https://docs.djangoproject.com/en/1.11/howto/deployment/wsgi/)
- [Change the database backend](https://docs.djangoproject.com/en/1.11/ref/databases/)

## Predefined backends
- If you don't want to go through the process of manually configuring a backend you can also import settings from other instances. We provide a [settings file](resources/backend-sample.csv) for a wiki data instance hosted at the Chair of Algorithms and Data Structures at the University of Freiburg.

## Authors
- Julian Bürklin <buerklij@informatik.uni-freiburg.de>
- Daniel Kemen <kemend@informatik.uni-freiburg.de>

University of Freiburg / 
Department of Computer Science / 
Chair of algorithms and data structures
