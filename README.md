# What is QLeverUI?
QLeverUI is a simple interactive user interface for QLever that helps you discover the scopes of very large knowledge bases by providing context sensitive suggestions and auto-completions.

## What is QLever?
QLever (pronounced "clever") is an efficient SPARQL engine which can handle very large datasets. For example, QLever can index the complete Wikidata (~ 7 billion triples) in less than 12 hours on a standard Linux machine using around 40 GB of RAM, with subsequent query times below 1 second even for relatively complex queries with large result sets. On top of the standard SPARQL functionality, QLever also supports SPARQL+Text search and SPARQL autocompletion.  

For more information on QLever, visit their [GitHub Repo](https://github.com/ad-freiburg/QLever).

# Overview
* [Building the QLeverUI Docker Image](#building-the-qleverui-docker-container)
* [Setting up the database](#setting-up-the-database)
* [Running a QLeverUI Docker container](#running-a-qleverui-docker-container)


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

# Setting up the database
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

# Running a QLeverUI Docker container
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
The first thing you should now do is head over to <http://localhost:8000/admin/> and setup your first QLever backend.  

If you don't have a QLever instance readily available to key in or just want to get up and running as fast as possible, you can use our [example settings](resources/) that use a QLever instance with Wikidata KB hosted at the Chair of Algorithms and Data Structures at the University of Freiburg.  
Just login to <http://localhost:8000/admin/>, click on Backends/Examples/Prefixes and import the respective `*-sample.csv` file.
