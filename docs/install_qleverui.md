# Installing QLever UI
* [Building the QLeverUI Docker Image](#building-the-qleverui-docker-container)
    * [Setting up the database](#setting-up-the-database)
    * [Running a QLeverUI Docker container](#running-a-qleverui-docker-container)
* [Installing QLever UI without docker](#installing-qlever-ui-without-docker)
    * [Setting up the database manually](#setting-up-the-database-manually)
    * [Running QLever UI without docker](#running-qlever-ui-without-docker)

<br>

Since QLever UI is built upon Python/Django you may find further information on the details and individual setups in the [django documentation](https://docs.djangoproject.com/en/3.0/ref/settings/).

<br>

# Building the QLeverUI Docker image
We consider [docker to be installed](https://docs.docker.com/get-docker/) on your machine for the following instructions.
1. To get stated clone the QLeverUI repo on your manchine:
    ```shell
    git clone https://github.com/ad-freiburg/qlever-ui.git qlever-ui
    cd qlever-ui
    ```
2. Before building the Docker Image, move [`settings_secret_template.py`](/qlever/settings_secret_template.py) to `settings_secret.py` and edit it to [fit your needs](https://docs.djangoproject.com/en/3.0/ref/settings/).
    ```shell
    mv qlever/settings_secret_template.py qlever/settings_secret.py
    ```
3. Finally build the Docker image:
    ```shell
    docker build -t qleverui .
    ```
    You have now created a Docker image that contains everything you need to run QLeverUI.

## Setting up the database
__NOTE: You can skip this step if you already have a database file.__  

1. To setup the database, first run a bash inside the QLeverUI container as follows.
    ```shell
    docker run -it --rm \
            -v "$(pwd)/db:/app/db" \
            --entrypoint "bash" qleverui
    ```
    Where `$(pwd)/db` is the path where QLeverUI will store it's database. If you want to use a separate path, make sure to  change this part in all subsequent `docker` commands.

2. Create the empty database file with the following command.
    ```shell
    python manage.py migrate
    ```
3. Then create a superuser for your database by entering
    ```shell
    python manage.py createsuperuser
    ```
    and following the instructions in your terminal.  

You can now exit the container as QLeverUI is finally ready to run.
## Running a QLeverUI Docker container
To run a QLeverUI container use the following command.
```shell
docker run -it -p 8000:8000 \
           -v "$(pwd)/db:/app/db" \
           --name qleverui \
           qleverui
``` 
__Note:__ If you already have a QLeverUI database file `qleverui.sqlite3` you want to use, make sure it is located in the specified path or provide the correct path to it.  
If you want the container to run in the background and restart automatically replace `-it` with `-d --restart=unless-stopped`  
You should now be able to connect to QLeverUI via <http://localhost:8000>. Continue with [configuring QLever UI](#configure-qlever-ui).


# Installing QLever UI without docker
When not using docker there are some additional steps to do. QLever UI is build upon a [Python 3](https://www.python.org/downloads/) / [Django 3](https://www.djangoproject.com/) backend so you will need to have Python 3 installed in order to run QLever UI. It's strongly recommended to use [virtual environments](https://docs.python.org/3/library/venv.html) to manage the project's dependencies when not using the docker build. In order to manage the dependencies we use pip.

1. If "[pip](https://pypi.org/project/pip/)" is installed on your system / in your virtual environment you can simply use 
    ```shell
    pip install -r requirements.txt
    ```
    inside the projects root folder to automatically install all dependencies. Otherwise you can find the list of dependencies in the `requirements.txt` file to install dem manually.

2. Next, you will need to adjust your individual settings in `qlever/settings_secret_template.py` and rename it to `qlever/settings_secret.py` to let QLever UI automatically detect your settings file. You may want to edit the file to [fit your needs](https://docs.djangoproject.com/en/3.0/ref/settings/).
    ```shell
    mv qlever/settings_secret_template.py qlever/settings_secret.py
    ```

## Setting up the database manually
1. The backend needs a database connection - by default SQLite is used and no further configuration is required. Simply run
    ```shell
    python manage.py make migrations —-merge && python manage.py migrate
    ```
    inside the project root folder in order to do so. You will only need to do this once. If you prefer you can also overwrite the database settings to use some other database management system in your `settings_secret.py`.

2. For configuring you QLever backend you will need an administrative user for the QLever UI administration panel. You can create an admin account by simply running the following command in your project root: 
    ```shell
    ./manage.py createsuperuser
    ```
## Running QLever UI without docker
You can either start a development server by simply running
```shell
./manage.py runserver localhost:8042
```
or prepare a productive environment.

You can start the development instance at any time with this single command and access your instance by opening http://localhost:8042. Feel free to change the port or hostname if needed. Read more about configuration in the [next chapter](docs/configure_qleverui.md)