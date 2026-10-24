# Settings and Users

## Personal preferences

After signing in, open "Settings → General" to adjust your own preferences:

| Setting | Default |
| --- | --- |
| Review before import | When on, review before saving; useful when every question must be checked |
| SVG animated explanations | On |
| GeoGebra interactive demos | Off |
| Duplicate similarity threshold | 90%; a question is a duplicate when the similarity is strictly greater |

Personal preferences are saved per user. The AI service configuration and the app time zone are global settings that require admin rights.

## App time zone

The app uses Beijing time, `Asia/Shanghai`, by default. Admins enter a valid IANA time zone name in "Settings → General → App time zone" and save, for example `UTC`, `Europe/London` or `America/New_York`.

The time zone is stored in the `timeZone` field of `config/app-config.json`. Older configurations without this field fall back to `Asia/Shanghai`; regular users can see the current global time zone.

These features use the app time zone:

- Dates shown on questions, practice history, exam papers and admin pages.
- The time in default exam titles, export file names and exam date entry.
- Daily and monthly statistics, and grade and semester calculation.

ISO times ending in `Z` in the database and API still represent the same absolute instant and are converted for display. After saving, the current page uses the new time zone and other open pages pick it up after a refresh; saved exam titles are not rewritten.

See the [time zone notes](https://github.com/margrop/wrong-notebook/blob/main/doc/TIME_ZONE.md) for details.

## Permissions and user management

| Role | Main permissions |
| --- | --- |
| Regular user | Manage their own questions, practice, exam papers and preferences; import and export their own data |
| Admin | Global AI and prompt settings, time zone, registration switch, user management and site-wide data import/export |

Admins open the dashboard from "Settings → User Management" to see usage statistics and enable, disable or delete users. Confirm the target and [back up your data](Backup-and-Restore-en) before deleting.

The default admin is only for initializing a fresh install. Upgrades of existing instances should keep the original accounts and must not re-run admin seeding.

## Background tasks and progress

The task entry at the bottom right of the page shows the status of long operations such as recognition, animations, re-solving, batch tagging, data import and exam generation. Some batch tasks show processed and failed counts.

The percentage on the entry screen is an estimate by stage (compress, upload, analyze, process, save), not the AI's real progress; the elapsed time shows how long you have been waiting.

The task list lives in the server process's memory. Navigating away usually does not stop processing that has already started on the server, but a restart clears the list and running tasks are not resumed from it. Completed business data is whatever was saved to the database.

## Check the running version

"About" in the settings and `GET /api/health` both show the running version. When troubleshooting, note the version, the steps to reproduce and the redacted error message; do not send real API keys or full configuration files.
