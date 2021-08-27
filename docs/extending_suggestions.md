# Adding fields for warmup queries
If you need additional fields for warmup queries follow these simple steps:

## 1. File `backend/backend/models.py`
1. Add the new field to `class Backend`, similar to the already existing fields:
    ```python
    class Backend(models.Model):
        # ...
        myField = models.TextField(
            default="",
            blank=True,
            verbose_name="My field",
            help_text="My field description",
        )
    ```
2. Add the new field to function `getWarmupAndAcPlaceholders`. This defines the name of the template variable. In this case, the template variable would therefore be called `%MY_Field%`
    ```python
    def getWarmupAndAcPlaceholders(self):
        data = {
            # ...
            "MY_FIELD": self.myField,
        }
        return data
    ```
3. (Optional) Add the field to `class BackendDefaults` if you want to be able to provide a default value for it.
    ```python
    class BackendDefaults(Backend):
        AVAILABLE_DEFAULTS = (
            # ...
            'myField'
        )
    ```
## 2. File `backend/backend/admin.py`
1. Add your field to `BackendAdmin.fieldsets`. This will make the field available in the django admin. Your field will most likely fit into the `'Warmup Query Patterns'` or `'Warmup Queries'` sections.
    ```python
    fieldsets = (
        # ...
        # Do not add your field to both sections. You need to decide for one of these!
        ('Warmup Query Patterns', {
            'fields': ('...', 'myField'),
            'description': '...'
        }),
        ('Warmup Queries', {
            'fields': ('...', 'myField'),
            'description': '...'
        }),
        # ...
    )
    ```

## 3. (Optional) File `backend/management/commands/warmup.py`
1. If your field is a warmup query that needs to be pinned in the QLever cache, add it to the `pin` function
    ```python
    def pin(self):
        prefixString = self._getPrefixString()

        warmups = (
            # ...
            (self.backend.myField,
             "Describe what this query does. This will be displayed in the log"),
        )
    ```

And that's all. Your new field is ready to use.