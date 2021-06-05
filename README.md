# What is QLeverUI?
QLeverUI is an easy to use interactive user interface for the very fast SPARQL search engine QLever that helps you to discover the scopes and information in very large knowledge bases by providing context sensitive suggestions and auto-completions and adding helpful information an views to the various outputs.

QLever UI supports different types of results (e.g. geographical data, named instances, images and more) and is highly customizable to the needs of its users and the structure of the underlying dataset.

### Authors, Contributors & Copyright
© 2016 - 2021 University of Freiburg, [Chair for Algorithms and Data Structures](https://ad.cs.uni-freiburg.de/)

- @jbuerklin <jb@software-design.de>   
- @dkemen <dk@software-design.de>
- @hannahbast <bast@informatik.uni-freiburg.de>

## What is QLever?
QLever (pronounced "clever") is an efficient SPARQL engine that can handle very large datasets. For example, QLever can index the complete Wikidata (~ 18 billion triples) in less than 24 hours on a standard Linux machine using around 40 GB of RAM, with subsequent query times below 1 second even for relatively complex queries with large result sets. On top of the standard SPARQL functionality, QLever also supports SPARQL+Text search and SPARQL autocompletion.

For more information on QLever, visit the corresponding [GitHub Repo](https://github.com/ad-freiburg/QLever).

# Overview
* [Building the QLeverUI Docker Image](#building-the-qleverui-docker-container)
    * [Setting up the database](#setting-up-the-database)
    * [Running a QLeverUI Docker container](#running-a-qleverui-docker-container)
* [Installing QLever UI without docker](#installing-qlever-ui-without-docker)
    * [Setting up the database manually](#setting-up-the-database-manually)
    * [Running QLever UI without docker](#running-qlever-ui-without-docker)
* [Configure QLeverUI](#configure-qlever-ui)
* [Extending QLeverUI / Contributions](#extending-qleverui)
    * [Extending SPARQL syntax]()
    * [Extending Langauge Parser]()
    * [Extending the user interface]()


# Building the QLeverUI Docker image
Clone the QLeverUI repo
```
git clone https://github.com/jbuerklin/qleverUI.git qleverui
cd qleverui
```
Before building the Docker Image, move `settings_secret_template.py` to `settings_secret.py` and edit it to fit your needs.
```
mv qlever/settings_secret_template.py qlever/settings_secret.py
```
Then build the Docker Image
```
docker build -t qleverui .
```
You have now created a Docker Image that contains everything you need to run QLeverUI.

## Setting up the database
__You can skip this step if you already have a database file.__  
To setup the database, first run a bash inside the QLeverUI container as follows.
```
docker run -it --rm \
           -v "$(pwd)/db:/app/db" \
           --entrypoint "bash" qleverui
```
Where `$(pwd)/db` is the path where QLeverUI will store it's database. If you want to use a separate path, make sure to  change this part in all subsequent `docker` commands.

Create the empty database file with the following command.
```
python manage.py migrate
```
Then create a superuser for your database by entering
```
python manage.py createsuperuser
```
and following the instructions in your terminal.  
You can now exit the container as QLeverUI is finally ready to run.

## Running a QLeverUI Docker container
To run a QLeverUI container use the following command.
```
docker run -it -p 8000:8000 \
           -v "$(pwd)/db:/app/db" \
           --name qleverui \
           qleverui
``` 
__Note:__ If you already have a QLeverUI database file `qleverui.sqlite3` you want to use, make sure it is located in the specified path or provide the correct path to it.  
If you want the container to run in the background and restart automatically replace `-it` with `-d --restart=unless-stopped`  
You should now be able to connect to QLeverUI via <http://localhost:8000>.  
# Installing QLever UI without docker
When not using docker there are some additional steps to do. QLever UI is build upon a [Python 3](https://www.python.org/downloads/) / [Django 3](https://www.djangoproject.com/) backend so you will need to have Python 3 installed in order to run QLever UI. It's strongly recommended to use [virtual environments](https://docs.python.org/3/library/venv.html) to manage the project's dependencies when not using the docker build. In order to manage the dependencies we use pip - if "[pip](https://pypi.org/project/pip/)" is installed on your system / in your virtual environment you can simply use 
```
	pip install -r requirements.txt
```
inside the projects root folder to automatically install all dependencies. Otherwise you can find the list of dependencies in the requirements.txt file to install dem manually.

Next, you will need to adjust your individual settings in `qlever/settings_secret_template.py` and rename it to `qlever/settings_secret.py` to let QLever UI automatically detect your settings file.
```
mv qlever/settings_secret_template.py qlever/settings_secret.py
```

## Setting up the database manually
The last step required is creating an SQLite database for the backend. Simply run
```
	python manage.py make migrations —-merge && python manage.py migrate
```
inside the project root folder in order to do so. You will only need to do this once. If you prefer you can also overwrite the database settings to use some other database management system in your settings_secret.py.

For configuring you QLever backend you will need an administrative user for the QLever UI administration panel. You can create an admin account by simply running the following command in your project root: 
```
	./manage.py createsuperuser
```
## Running QLever UI without docker
You can either start a development server by simply running
```
	./manage.py runserver localhost:8042
```
or prepare a productive environment.

You can start the development instance at any time with this single command and access your instance by opening http://localhost:8042. Feel free to change the port or hostname if needed.

# Configure QLever UI

Assuming that you already have a QLever Instance running and super user created you can now configure your existing QLever backend in you new QLever UI instance. 

You may access the admin panel by adding `/admin` to the URL you are using for your QLever UI instance and login with the credentials you just created.

If you don't have a QLever instance readily available to key in or just want to get up and running as fast as possible, you can use our [example settings](resources/) that use a QLever instance with Wikidata KB hosted at the Chair of Algorithms and Data Structures at the University of Freiburg.  

Click "Backends" and "Add backend" in order to start configuring your first QLever backend. There are many help texts below each configuration box that guide you through the process. If you are done save the settings and reload the QLever UI interface.

You can also import the respective `*-sample.csv` file for the example backend.

If everything worked correctly you should see backend details displayed on top right of the regular QLever UI. If not you can enable details error logging in the user interface (in top right dropdown menu) and open your browsers developer console to see the outputs.

# Extending QLever UI
## Construct and theoretical approach
All information about the theoretical concept and approach and any conciderations done are found in the papers of J. Bürklin and D. Kemen on QLever UI (links will follow)

Everything regarding the implementation / extension of the code base can be found in the following.
## Extending the code
QLever UI uses the Code Mirror Code editor and a few of its available addons which already provides a useful set of tools like line counts, highlighting the active line, search and replace and many more.

Many features of QLever UI are built on top of the CodeMirror API / Addons or at least actively make use of them.

CodeMirror related code is stored in [/static/js/codemirror/](/static/js/codemirror/). There are plenty of modes for different programming languages supported by CodeMirror available. We built our own SPARQL language mode which is similar to the SQL mode due to the parallels between both languages.

There a full documentation for [language modes](https://codemirror.net/doc/manual.html#modeapi) on the website of CodeMirror which describes the CodeMirror API features we used in our mode at [/static/js/codemirror/modes/sparql/sparql.js](/static/js/codemirror/modes/sparql/sparql.js).

One may also make use of different code themes / styles as using different color schemes is also supported by default.

**Further reading**
- [Basic usage of CodeMirror](https://codemirror.net/doc/manual.html)
- [Extending / Customizing CodeMirror](https://codemirror.net/doc/manual.html#api)
- [Available Addons](https://codemirror.net/doc/manual.html#addons)

For any features that are unrelated to the actual text editor window (results, shares, etc.) there is a [qleverUI.js](/static/js/qleverUI.js) and a [helper.js](/static/js/helper.js) for some helper functions used within the code.

### Extending the Tokenizer
By default CodeMirror uses a tokenizer in order to separate elements in a code lines to generate an HTML DOM representation of the actual value of the editor. This is intentionally used in order to allow syntax highlighting and QLever UI makes active use on it.

The tokenizer can be found in the [SPARQL mode](/static/js/codemirror/modes/sparql/sparql.js). When there is need to separate more tokens than the ones already present (variable, bracket, prefix-declaration, keyword,...) one can extend the tokenizer to return more values.

Each mode get its own css class in the rendering which allows to easily style the new tokens. For example the "variable"-token get a class called `cm-variable` that can have custom styling attributes in [codemirror.css](/static/css/codemirror.css).
#### Extending the Parser
For making suggestions there is a separate [sprawl-hint.js](/static/js/codemirror/modes/sparql/sparql-hint.js) in the language mode folder that actually cares about the context-sensitivity.

According to the SPARQL grammar there are different contexts within a query - for example the *SelectClause*, the *WhereClause* or the *SolutionModifier* - QLever UI also uses these contexts and keeps a definition of available contexts in the [SPARQL language file](/static/js/codemirror/modes/sparql/sparql.js) as a constant variable.

Within a context there are different parts of a query that may or may not occur at a specific position. Next to simple keywords and variables there are many constructs to use. We refer to them as complex types.

There is also a constant definition of all available `COMPLEXTTYPES` in the [SPARQL language file](/static/js/codemirror/modes/sparql/sparql.js). A complex type consists of a name, a definition on how to detect it if present and a callback that provides all the different variations of this type that might be relevant.

Additionally each type has a list of `CONTEXTS` it is compatible with and some optional configuration parameter that may limit the occurrence of this type to only one or only one per variation (e.g. each combination of a keyword with one variable is considered to be a variation).

Also there are options to hide suggestions until they match whats currently typed (e.g. to prevent always suggestion subquerys or optionals in each and every line where they may occur).

As new types / contexts will be available in QLever one can easily extend the according definition. For un-nested types adding the `COMPLEXTTYPES` is sufficient. If there are other complex types that may occur within brackets or at any other position within the type itself one needs to add a context for the "inside" of this complex type and add complextypes that are allowed within the context. 

### Extending the hints

### Extending 