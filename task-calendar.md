# Obsidian-Tasks-Calendar

```dataviewjs
const page = dv.current();
const config = {
  // A leading slash resolves paths from the vault root.
  taskFolder: "/misc",
  dailyNoteFolder: "/misc/dated/daily",
  view: "month",
  firstDayOfWeek: "1",
  options: "style1 noDailyNote filter",
  mergeTasks: true,
};

await dv.view(page.file.folder, config);
```
