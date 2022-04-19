# Makefile for transfering entries from the master DB to this DB. The master DB
# is essentially a snapshot of the DB behind the official QLever UI instance on
# https://qlever.cs.uni-freiburg.de . This DB provides the configuration for
# this working copy. A typical use case is to (easily = with as little effort as
# possible) get an instance of the QLever UI for a single backend, taking
# advantage of a preconfiguration if that dataset is known.

# TROUBLESHOOTING (some issues I encountered and how I solved them):
#
# Problem with warmup: The baseUrl must match the name of the machine, just
# localhost results in a "Connection refused" (not sure why).

THIS_DB = db/qleverui.sqlite3
MASTER_DB = db/master.sqlite3
TABLE_BACKENDS = backend_backend
TABLE_EXAMPLES = backend_example
QLEVERUI_IMAGE = qlever-ui
QLEVERUI_CONTAINER = qlever-ui

SQL_FILE = sql.tmp
LOG_FILE = log.tmp
ERROR_CMD = ( echo "\033[31mAn error occured, check $(LOG_FILE) for details, the last 10 lines are:\033[0m" && tail $(LOG_FILE) )

HOSTNAME = $(shell hostname -f)
FRONTEND_PORT = 7000
BACKEND_PORT = 7019
CONFIG_SLUG = olympics
ID = 2

# Create an instance of the QLever UI, the log should be self-explaining. Will
# also provide help if something went wrong.
all:
	@echo
	@echo "\033[34mCreating a QLEVER UI instance\033[0m"
	@echo
	@echo "Example usage: make CONFIG_SLUG=olympics BACKEND_PORT=7019"
	@echo
	@printf "HOSTNAME      = %-25s   [the name of the machine, set explicitly if it's wrong]\n" $(HOSTNAME)
	@printf "BACKEND_PORT  = %-25s   [expecting an instance of the QLever engine listening on this port]\n" $(BACKEND_PORT)
	@printf "FRONTEND_PORT = %-25s   [the QLever UI will be running under this port]\n" $(FRONTEND_PORT)
	@printf "CONFIG_SLUG   = %-25s   [using this pre-configuration of the QLever UI (prefixes, autocompletion, etc.]\n" $(CONFIG_SLUG)
	@echo
	@> $(LOG_FILE)
	@echo "Creating config ..."
	@$(MAKE) -s CONFIG_SLUG=$(CONFIG_SLUG) ID=$(ID) overwrite_config >> $(LOG_FILE) 2>&1 || $(ERROR_CMD)
	@echo "Launching QLever UI ..."
	@$(MAKE) -s HOSTNAME=$(HOSTNAME) QLEVERUI_IMAGE=$(QLEVERUI_IMAGE) QLEVERUI_CONTAINER=$(QLEVERUI_CONTAINER) qlever-ui >> $(LOG_FILE) 2>&1 || $(ERROR_CMD)
	@echo "Warmup queries for fast autocompletion (check HOSTNAME and PORTs if something goes wrong here) ..."
	@$(MAKE) -s CONFIG_SLUG=$(CONFIG_SLUG) QLEVERUI_CONTAINER=$(QLEVERUI_CONTAINER) warmup >> $(LOG_FILE) 2>&1 || $(ERROR_CMD)
	@echo
	@echo "Looks like it worked, go to http://$(HOSTNAME):$(FRONTEND_PORT) and try out some queries"
	@echo "If it doesn't work, check \"$(LOG_FILE)\" for suspicious messages or \"Makefile\" for troubleshooting help"
	@echo

# Get configuration from master DB as REPLACE command with the given ID. Note
# that the default configuration has ID = 2, so for a single backend, we want to
# overwrite the configuration with ID = 2.
get_config:
	sqlite3 $(MASTER_DB) ".mode insert $(TABLE_BACKENDS)" "SELECT * FROM $(TABLE_BACKENDS) WHERE slug = '$(CONFIG_SLUG)';" \
	  | sed 's/INSERT/REPLACE/; s/VALUES([0-9]\+/VALUES(2/'

# Get example queries from master DB.
get_examples:
	sqlite3 db/master.sqlite3 ".mode insert $(TABLE_EXAMPLES)" "SELECT $(TABLE_EXAMPLES).* FROM $(TABLE_BACKENDS), $(TABLE_EXAMPLES) WHERE $(TABLE_BACKENDS).slug = '$(CONFIG_SLUG)' AND $(TABLE_BACKENDS).id = $(TABLE_EXAMPLES).backend_id;"

# Overwrite config in this DB.
overwrite_config:
	@echo "\n\033[34mOverwrite config in $(THIS_DB) with the following command, show new with make show_config\033[0m"
	> $(SQL_FILE)
	# Overwrite entry in backend_backend
	@$(MAKE) -s CONFIG_SLUG=$(CONFIG_SLUG) get_config >> $(SQL_FILE)
	@echo "UPDATE $(TABLE_BACKENDS) SET isDefault = 1 WHERE ID = $(ID);" >> $(SQL_FILE)
	@echo "UPDATE $(TABLE_BACKENDS) SET apiToken = '' WHERE ID = $(ID);" >> $(SQL_FILE)
	@echo "UPDATE $(TABLE_BACKENDS) SET baseUrl = 'http://$(HOSTNAME):$(BACKEND_PORT)' WHERE ID = $(ID);" >> $(SQL_FILE)
	@if [ $(ID) -eq "2" ]; then echo "DELETE FROM $(TABLE_BACKENDS) WHERE ID > $(ID);" >> $(SQL_FILE); fi
	# Insert entries in backend_example
	@if [ $(ID) -eq "2" ]; then echo "DELETE FROM $(TABLE_EXAMPLES);" >> $(SQL_FILE); fi
	@$(MAKE) -s CONFIG_SLUG=$(CONFIG_SLUG) get_examples >> $(SQL_FILE)
	@echo "UPDATE $(TABLE_EXAMPLES) SET backend_id = $(ID);" >> $(SQL_FILE)
	@cat $(SQL_FILE)
	@sqlite3 $(THIS_DB) < $(SQL_FILE)

# Show the config of this DB.
show_config:
	@echo "\033[34mTable $(TABLE_BACKENDS)\033[0m"
	sqlite3 $(THIS_DB) ".mode insert $(TABLE_BACKENDS)" "SELECT * FROM $(TABLE_BACKENDS);"
	@echo "\033[34mTable $(TABLE_EXAMPLES)\033[0m"
	sqlite3 $(THIS_DB) ".mode insert $(TABLE_EXAMPLES)" "SELECT * FROM $(TABLE_BACKENDS);"

# Show the schema of this DB.
get_schema:
	sqlite3 $(THIS_DB) ".schema $(TABLE_BACKENDS)"

# Restore from git master.
restore:
	git checkout $(THIS_DB)

# Get all config slugs from the master DB (they are unique because they
# determine the URL of that instance in the QLever UI).
slugs:
	@echo "\n\033[34mAll config slugs from $(MASTER_DB)\033[0m" 	
	@sqlite3 $(MASTER_DB) "SELECT slug FROM backend_backend;" | paste -s -d " "

# Startup instance of QLever UI.
qlever-ui:
	@echo "\n\033[34mBuilding docker image $(QLEVERUI_IMAGE) ...\033[0m" 	
	-docker rm -f qlever-ui
	docker build -t qlever-ui .
	@echo "\n\033[34mLaunching QLever UI on http://$(HOSTNAME):$(FRONTEND_PORT) ...\033[0m" 	
	docker run -d -p $(FRONTEND_PORT):7000 --name $(QLEVERUI_CONTAINER) $(QLEVERUI_IMAGE)
	@echo "\n\033[34mShowing first lines of log (after waiting for one second) ...\033[0m" 	
	sleep 1 && docker logs $(QLEVERUI_CONTAINER)

# Launch warmup queries via QLever UI.
warmup:
	@echo "\n\033[34mLaunch warmup queries for the QLever UI autocompletion ...\033[0m" 	
	@docker exec -it $(QLEVERUI_CONTAINER) bash -c "python manage.py warmup $(CONFIG_SLUG) pin"
