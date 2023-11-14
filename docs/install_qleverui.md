# Installing QLever UI
* [Building the QLever UI Docker Image](#building-the-qlever-ui-docker-container)
    * [Setting up the database](#setting-up-the-database)
    * [Running a QLever UI Docker container](#running-a-qlever-ui-docker-container)
* [Installing QLever UI without docker](#installing-qlever-ui-without-docker)
    * [Setting up the database manually](#setting-up-the-database-manually)
    * [Running QLever UI without docker](#running-qlever-ui-without-docker)

<br>

Since QLever UI was built upon Python/Django further information and details on the setup and configuration process (especially in production environments) can be found in the [Django documentation](https://docs.djangoproject.com/en/3.0/).
<br><br>
We provide a [docker image](#building-the-qlever-ui-docker-container) as well as instructions for a [manual setup](#installing-qlever-ui-without-docker).
<br>

# Building the QLever UI Docker Image
We assume [docker to be installed](https://docs.docker.com/get-docker/) on your machine for the following instructions. 
1. To get started clone the QLever UI repo on your machine:
    ```shell
    git clone https://github.com/ad-freiburg/qlever-ui.git qlever-ui
    cd qlever-ui
    ```
2. Before building the Docker Image, move the [`settings_secret_template.py`](/qlever/settings_secret_template.py) file to `settings_secret.py` and adjust it to [fit your needs](https://docs.djangoproject.com/en/3.0/ref/settings/).
    ```shell
    mv qlever/settings_secret_template.py qlever/settings_secret.py
    ```
3. Finally, build the Docker image by running:
    ```shell
    docker build -t qleverui .
    ```
    You have now created a Docker Image that contains everything you need to run QLever UI.

## Setting up the database
__NOTE: You can skip this step if you already have a database file.__  

1. To set up the database, first, run a bash shell inside the QLever UI container as follows.
    ```shell
    docker run -it --rm \
            -v "$(pwd)/db:/app/db" \
            --entrypoint "bash" qleverui
    ```
    Where `$(pwd)/db` is the path where QLever UI should store its database. If you want to use a different path, make sure to change this part in all subsequent `docker` commands.

2. Create the empty database file with the following command.
    ```shell
    python manage.py migrate
    ```
3. For configuring your QLever UI backend you will need an administrative user for the QLever UI administration panel. You can create a "superuser" by entering
    ```shell
    python manage.py createsuperuser
    ```
    and following the instructions in your terminal.  

You can now exit the container as QLever UI is finally ready to run.
## Running a QLever UI Docker Container
To run a QLever UI container use the following command:
```shell
docker run -it -p 7000:7000 \
           -v "$(pwd)/db:/app/db" \
           --name qleverui \
           qleverui
``` 
__Note:__ If you already have a QLever UI database file `qleverui.sqlite3` you want to use, make sure it is located in the specified path or provide the correct path to it.  
If you want the container to run in the background and restart automatically replace `-it` with `-d --restart=unless-stopped`  
You should now be able to connect to QLever UI via <http://localhost:7000>. Continue with [configuring QLever UI](./configure_qleverui.md).


# Installing QLever UI without docker
When not using docker there are some additional steps to do. QLever UI is built upon a [Python 3](https://www.python.org/downloads/) / [Django 3](https://www.djangoproject.com/) backend so you will need to have Python 3 installed in order to run QLever UI. It's strongly recommended to use [virtual environments](https://docs.python.org/3/library/venv.html) to manage the project's dependencies when not using the docker build. In order to manage the dependencies, we use pip.

1. If "[pip](https://pypi.org/project/pip/)" is installed on your system / in your virtual environment you can simply use 
    ```shell
    pip install -r requirements.txt
    ```
    inside the project folder to automatically install all dependencies. Otherwise, you can find the list of dependencies in the `requirements.txt` file to install them manually.

2. Next, you will need to adjust your individual settings in `qlever/settings_secret_template.py` and rename it to `qlever/settings_secret.py`. You may want to edit the file to [fit your needs](https://docs.djangoproject.com/en/3.0/ref/settings/).
    ```shell
    mv qlever/settings_secret_template.py qlever/settings_secret.py
    ```

## Setting up the database manually
1. The QLever UI backend needs a database connection - by default SQLite is used and no further configuration is required. Simply run:
    ```shell
    python manage.py makemigrations —-merge && python manage.py migrate
    ```
    inside the project folder in order to do so. You will only need to do this once. If you prefer you can also overwrite the database [settings](https://docs.djangoproject.com/en/3.0/ref/settings/) to use some other database management system in your `settings_secret.py`.

2. For configuring your QLever UI backend you will need an administrative user for the QLever UI administration panel. You can create an admin account by simply running the following command in your project folder: 
    ```shell
    ./manage.py createsuperuser
    ```
    and following the instructions in your terminal.  
## Running QLever UI without docker
You can either start a development server by simply running
```shell
./manage.py runserver localhost:7000
```
or prepare a productive environment as described in the [Django documentation](https://docs.djangoproject.com/en/3.0/).

You can start the development instance at any time with this single command and access your instance by opening http://localhost:7000. Feel free to change the port or hostname if needed.
Read more about configuration in the [next chapter](./configure_qleverui.md).
