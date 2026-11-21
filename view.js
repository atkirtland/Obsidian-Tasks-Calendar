let {
  pages,
  taskFolder,
  baseFolder,
  view,
  firstDayOfWeek,
  globalTaskFilter,
  dailyNoteFolder,
  dailyNoteFormat,
  startPosition,
  upcomingDays,
  css,
  options,
  mergeTasks,  // If true, tasks appearing in multiple categories show once with combined icons
} = input;

// Folder options are relative to the note containing the Dataview block. This
// keeps the view portable when its folder (or the whole vault) is moved. A
// leading slash may still be used for an explicit vault-root-relative path.
baseFolder = normalizeVaultPath(baseFolder || dv.current()?.file?.folder || "", "");
if (taskFolder !== undefined) {
  taskFolder = resolveVaultPath(taskFolder, baseFolder);
}
if (dailyNoteFolder) {
  dailyNoteFolder = resolveVaultPath(dailyNoteFolder, baseFolder);
}

// Default mergeTasks to false (original behavior) if not specified
if (mergeTasks === undefined) {
  mergeTasks = false;
}

// Error Handling
if (pages === undefined && taskFolder === undefined) {
  dv.span(
    '> [!ERROR] Missing task source\n> \n> Set `taskFolder` (recommended) or the advanced `pages` option.',
  );
  return false;
}
if (!options.includes("style")) {
  dv.span(
    '> [!ERROR] Missing style parameter\n> \n> Please set a style inside options parameter like\n> \n> `options: "style1"`',
  );
  return false;
}
if (!view) {
  dv.span(
    '> [!ERROR] Missing view parameter\n> \n> Please set a default view inside view parameter like\n> \n> `view: "month"`',
  );
  return false;
}
if (firstDayOfWeek) {
  if (firstDayOfWeek.match(/[|\\0123456]/g) == null) {
    dv.span(
      "> [!ERROR] Wrong value inside firstDayOfWeek parameter\n> \n> Please choose a number between 0 and 6",
    );
    return false;
  }
} else {
  dv.span(
    '> [!ERROR] Missing firstDayOfWeek parameter\n> \n> Please set the first day of the week inside firstDayOfWeek parameter like\n> \n> `firstDayOfWeek: "1"`',
  );
  return false;
}
if (startPosition) {
  if (!startPosition.match(/\d{4}\-\d{1,2}/gm)) {
    dv.span(
      "> [!ERROR] Wrong startPosition format\n> \n> Please set a startPosition with the following format\n> \n> Month: `YYYY-MM` | Week: `YYYY-ww`",
    );
    return false;
  }
}
if (dailyNoteFormat) {
  if (
    dailyNoteFormat.match(/[|\\YMDWwd.,-: \[\]]/g).length !=
    dailyNoteFormat.length
  ) {
    dv.span("> [!ERROR] The `dailyNoteFormat` contains invalid characters");
    return false;
  }
}

// Get tasks. taskFolder is the portable, relative-path option; pages remains
// available for advanced Dataview source expressions and pre-built task lists.
if (taskFolder !== undefined) {
  var tasks = dv.pages(taskFolder ? `"${taskFolder}"` : "").file.tasks;
} else if (pages == "") {
  var tasks = dv.pages().file.tasks;
} else if (typeof pages === "string" && pages.startsWith("dv.pages")) {
  var tasks = eval(pages);
} else if (Array.isArray(pages) && pages.every((p) => p.task)) {
  var tasks = pages;
} else {
  var tasks = dv.pages(pages).file.tasks;
}

// Variables
var done,
  doneWithoutCompletionDate,
  due,
  recurrence,
  overdue,
  start,
  scheduled,
  process,
  cancelled,
  dailyNote,
  dailyNoteRegEx;
if (!dailyNoteFormat) {
  dailyNoteFormat = "YYYY-MM-DD";
}
var dailyNoteRegEx = momentToRegex(dailyNoteFormat);
var tToday = moment().format("YYYY-MM-DD");
var tMonth = moment().format("M");
var tDay = moment().format("d");
var tYear = moment().format("YYYY");
var tid = new Date().getTime();
if (startPosition) {
  var selectedMonth = moment(startPosition, "YYYY-MM").date(1);
  var selectedList = moment(startPosition, "YYYY-MM").date(1);
  var selectedWeek = moment(startPosition, "YYYY-ww").startOf("week");
} else {
  var selectedMonth = moment(startPosition).date(1);
  var selectedWeek = moment(startPosition).startOf("week");
  var selectedList = moment(startPosition).date(1);
}
// View lookups (replaces eval)
var selectedDates = { month: selectedMonth, week: selectedWeek, list: selectedList };
var selectedDate = selectedDates[view];
var arrowLeftIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>';
var arrowRightIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>';
var filterIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>';
var monthIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><path d="M8 14h.01"></path><path d="M12 14h.01"></path><path d="M16 14h.01"></path><path d="M8 18h.01"></path><path d="M12 18h.01"></path><path d="M16 18h.01"></path></svg>';
var weekIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><path d="M17 14h-6"></path><path d="M13 18H7"></path><path d="M7 14h.01"></path><path d="M17 18h.01"></path></svg>';
var listIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>';
var calendarClockIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"></path><path d="M16 2v4"></path><path d="M8 2v4"></path><path d="M3 10h5"></path><path d="M17.5 17.5 16 16.25V14"></path><path d="M22 16a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z"></path></svg>';
var calendarCheckIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><path d="m9 16 2 2 4-4"></path></svg>';
var calendarHeartIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h7"></path><path d="M16 2v4"></path><path d="M8 2v4"></path><path d="M3 10h18"></path><path d="M21.29 14.7a2.43 2.43 0 0 0-2.65-.52c-.3.12-.57.3-.8.53l-.34.34-.35-.34a2.43 2.43 0 0 0-2.65-.53c-.3.12-.56.3-.79.53-.95.94-1 2.53.2 3.74L17.5 22l3.6-3.55c1.2-1.21 1.14-2.8.19-3.74Z"></path></svg>';
var cellTemplate =
  "<div class='cell {{class}}' data-weekday='{{weekday}}'><a class='internal-link cellName' href='{{dailyNote}}'>{{cellName}}</a><div class='cellContent'>{{cellContent}}</div></div>";
var taskTemplate =
  "<a class='internal-link' href='{{taskPath}}'><div class='task {{class}}' style='{{style}}' title='{{title}}'><div class='inner'><div class='note'>{{note}}</div><div class='icon'>{{icon}}</div><div class='description' data-relative='{{relative}}'>{{taskContent}}</div></div></div></a>";
const rootNode = dv.el("div", "", {
  cls: "tasksCalendar " + options,
  attr: {
    id: "tasksCalendar" + tid,
    view: view,
    style: "position:relative;-webkit-user-select:none!important",
  },
});
if (css) {
  var style = document.createElement("style");
  style.innerHTML = css;
  rootNode.append(style);
}
// Task icons lookup (replaces eval)
var taskIcons = {
  done: "✅",
  due: "📅",
  scheduled: "⏳",
  recurrence: "🔁",
  overdue: "⚠️",
  process: "⏺️",
  cancelled: "🚫",
  start: "🛫",
  dailyNote: "📄",
};
var optionSet = new Set(String(options || "").split(/\s+/).filter(Boolean));
var hiddenTaskTypes = {
  scheduled: "noScheduled",
  start: "noStart",
  due: "noDue",
  done: "noDone",
  process: "noProcess",
  recurrence: "noRecurrence",
  overdue: "noOverdue",
  dailyNote: "noDailyNote",
};
var typeRank = {
  overdue: 0,
  due: 1,
  recurrence: 2,
  start: 3,
  scheduled: 4,
  process: 5,
  dailyNote: 6,
  done: 7,
  cancelled: 8,
};

// Task index for fast date lookups (built once during initialization)
var taskIndex = {
  byCompletionDate: new Map(),
  byDueDate: new Map(),
  byStartDate: new Map(),
  byScheduledDate: new Map(),
  byDailyNote: new Map(),
  byCancelledDate: new Map(),
  allIncomplete: [],  // for overdue calculations
  incompleteWithStart: [],  // for process calculations (smaller subset)
  overdueToday: [],   // pre-computed overdue tasks (only shown on today)
};

// Process tasks depend on the currently rendered date range. Build this map
// once per view instead of scanning every task once per calendar cell.
var processIndex = new Map();

// Note metadata cache (avoids repeated dv.pages calls)
var noteMetaCache = new Map();

// Initialize
getMeta(tasks);
buildTaskIndex(tasks);
setButtons();
setStatisticPopUp();
setWeekViewContext();
// View function lookup (replaces eval)
var viewFunctions = { month: getMonth, week: getWeek, list: getList };
viewFunctions[view](tasks, selectedDate);

function getMeta(tasks) {
  // dailyNoteRegEx is now already a RegExp (no eval needed)
  for (i = 0; i < tasks.length; i++) {
    var taskText = tasks[i].text;
    var taskFile = getFilename(tasks[i].path);
    var dailyNoteMatch = taskFile.match(dailyNoteRegEx);
    var dailyTaskMatch = taskText.match(/(\d{4}\-\d{2}\-\d{2})/);
    if (dailyNoteMatch) {
      if (!dailyTaskMatch) {
        tasks[i].dailyNote = moment(dailyNoteMatch[1], dailyNoteFormat).format(
          "YYYY-MM-DD",
        );
      }
    }
    var dueMatch = taskText.match(/\📅\W(\d{4}\-\d{2}\-\d{2})/);
    if (dueMatch) {
      tasks[i].due = dueMatch[1];
      tasks[i].text = tasks[i].text.replace(dueMatch[0], "");
    }
    var startMatch = taskText.match(/\🛫\W(\d{4}\-\d{2}\-\d{2})/);
    if (startMatch) {
      tasks[i].start = startMatch[1];
      tasks[i].text = tasks[i].text.replace(startMatch[0], "");
    }
    var scheduledMatch = taskText.match(/\⏳\W(\d{4}\-\d{2}\-\d{2})/);
    if (scheduledMatch) {
      tasks[i].scheduled = scheduledMatch[1];
      tasks[i].text = tasks[i].text.replace(scheduledMatch[0], "");
    }
    var completionMatch = taskText.match(/\✅\W(\d{4}\-\d{2}\-\d{2})/);
    if (completionMatch) {
      tasks[i].completion = completionMatch[1];
      tasks[i].text = tasks[i].text.replace(completionMatch[0], "");
    }
    var repeatMatch = taskText.includes("🔁");
    if (repeatMatch) {
      tasks[i].recurrence = true;
      tasks[i].text = tasks[i].text.substring(0, taskText.indexOf("🔁"));
    }
    var lowMatch = taskText.includes("🔽");
    if (lowMatch) {
      tasks[i].priority = "D";
    }
    var mediumMatch = taskText.includes("🔼");
    if (mediumMatch) {
      tasks[i].priority = "B";
    }
    var highMatch = taskText.includes("⏫");
    if (highMatch) {
      tasks[i].priority = "A";
    }
    if (!lowMatch && !mediumMatch && !highMatch) {
      tasks[i].priority = "C";
    }
    if (globalTaskFilter) {
      tasks[i].text = tasks[i].text.replaceAll(globalTaskFilter, "");
    } else {
      tasks[i].text = tasks[i].text.replaceAll("#task", "");
    }
    tasks[i].text = tasks[i].text.replaceAll("[[", "");
    tasks[i].text = tasks[i].text.replaceAll("]]", "");
    tasks[i].text = tasks[i].text.replace(/\[.*?\]/gm, "");
  }
}

// Build task index for O(1) date lookups instead of O(n) filtering
function buildTaskIndex(tasks) {
  // Helper to add task to a date map
  function addToDateMap(map, dateStr, task) {
    if (!map.has(dateStr)) {
      map.set(dateStr, []);
    }
    map.get(dateStr).push(task);
  }

  for (var i = 0; i < tasks.length; i++) {
    var task = tasks[i];
    task._calendarStatus = getTaskStatus(task);
    task._completionDate = normalizeDate(task.completion);
    task._dueDate = normalizeDate(task.due);
    task._startDate = normalizeDate(task.start);
    task._scheduledDate = normalizeDate(task.scheduled);
    task._dailyNoteDate = normalizeDate(task.dailyNote);
    task._sortPriority = String(task.priority || "C").toUpperCase();
    task._sortText = String(task.text || "").toUpperCase();
    
    // Index completed tasks by completion date
    if (task._completionDate) {
      addToDateMap(taskIndex.byCompletionDate, task._completionDate, task);
    }
    
    // Index tasks with due dates
    if (task._dueDate) {
      addToDateMap(taskIndex.byDueDate, task._dueDate, task);
    }
    
    // Index tasks with start dates
    if (task._startDate) {
      addToDateMap(taskIndex.byStartDate, task._startDate, task);
    }
    
    // Index tasks with scheduled dates
    if (task._scheduledDate) {
      addToDateMap(taskIndex.byScheduledDate, task._scheduledDate, task);
    }
    
    // Index tasks by daily note date
    if (task._dailyNoteDate) {
      addToDateMap(taskIndex.byDailyNote, task._dailyNoteDate, task);
    }

    if (task._calendarStatus === "cancelled") {
      var cancelledDates = new Set([
        task._dueDate,
        task._startDate,
        task._scheduledDate,
        task._dailyNoteDate,
      ]);
      cancelledDates.delete("");
      cancelledDates.forEach((date) =>
        addToDateMap(taskIndex.byCancelledDate, date, task),
      );
    }
    
    // Track incomplete tasks with due dates (for overdue calculations)
    if (task._calendarStatus === "active" && task._dueDate) {
      taskIndex.allIncomplete.push(task);
      
      // Pre-compute overdue tasks (due before today)
      if (task._dueDate < tToday) {
        taskIndex.overdueToday.push(task);
      }
      
      // Track tasks with start dates for process calculations (smaller subset)
      if (task._startDate) {
        taskIndex.incompleteWithStart.push(task);
      }
    }
  }
}

function getTaskStatus(task) {
  var status = String(task.status || "");
  if (task.completed || status === "x" || status === "X") return "done";
  if (status === "-" || status === "~") return "cancelled";
  return "active";
}

function normalizeDate(value) {
  if (!value) return "";
  if (typeof value.toISODate === "function") return value.toISODate();
  var match = String(value).match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

function addIsoDays(date, days) {
  var parts = date.split("-").map(Number);
  var value = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days));
  return value.toISOString().slice(0, 10);
}

function prepareProcessIndex(rangeStart, rangeEnd) {
  processIndex = new Map();
  for (var i = 0; i < taskIndex.incompleteWithStart.length; i++) {
    var task = taskIndex.incompleteWithStart[i];
    var first = addIsoDays(task._startDate, 1);
    var last = addIsoDays(task._dueDate, -1);
    if (first < rangeStart) first = rangeStart;
    if (last > rangeEnd) last = rangeEnd;
    for (var date = first; date <= last; date = addIsoDays(date, 1)) {
      if (!processIndex.has(date)) processIndex.set(date, []);
      processIndex.get(date).push(task);
    }
  }
}

function getFilename(path) {
  var filename = path.match(/^(?:.*\/)?([^\/]+?|)(?=(?:\.[^\/.]*)?$)/)[1];
  return filename;
}

function normalizeVaultPath(path, fallback) {
  if (path === undefined || path === null || path === "") return fallback;
  var parts = String(path).replace(/\\/g, "/").split("/");
  var normalized = [];
  for (var part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") normalized.pop();
    else normalized.push(part);
  }
  return normalized.join("/");
}

function resolveVaultPath(path, fromFolder) {
  var value = String(path || "").replace(/\\/g, "/");
  if (value.startsWith("/")) return normalizeVaultPath(value, "");
  return normalizeVaultPath((fromFolder ? fromFolder + "/" : "") + value, "");
}

function capitalize(str) {
  return str[0].toUpperCase() + str.slice(1);
}

function getMetaFromNote(task, metaName) {
  // Lazy-load and cache metadata only when first requested
  var notePath = task.link?.path;
  if (!notePath) return "";
  
  if (!noteMetaCache.has(notePath)) {
    // Only fetch metadata when actually needed (lazy loading)
    var notePage = dv.page(notePath);
    noteMetaCache.set(notePath, {
      color: notePage?.color || "",
      textColor: notePage?.textColor || "",
      icon: notePage?.icon || "",
    });
  }
  return noteMetaCache.get(notePath)[metaName] || "";
}

function transColor(color, percent) {
  var num = parseInt(color.replace("#", ""), 16),
    amt = Math.round(2.55 * percent),
    R = (num >> 16) + amt,
    B = ((num >> 8) & 0x00ff) + amt,
    G = (num & 0x0000ff) + amt;
  return (
    "#" +
    (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (B < 255 ? (B < 1 ? 0 : B) : 255) * 0x100 +
      (G < 255 ? (G < 1 ? 0 : G) : 255)
    )
      .toString(16)
      .slice(1)
  );
}

function momentToRegex(momentFormat) {
  momentFormat = momentFormat.replaceAll(".", "\\.");
  momentFormat = momentFormat.replaceAll(",", "\\,");
  momentFormat = momentFormat.replaceAll("-", "\\-");
  momentFormat = momentFormat.replaceAll(":", "\\:");
  momentFormat = momentFormat.replaceAll(" ", "\\s");

  momentFormat = momentFormat.replace("dddd", "\\w{1,}");
  momentFormat = momentFormat.replace("ddd", "\\w{1,3}");
  momentFormat = momentFormat.replace("dd", "\\w{2}");
  momentFormat = momentFormat.replace("d", "\\d{1}");

  momentFormat = momentFormat.replace("YYYY", "\\d{4}");
  momentFormat = momentFormat.replace("YY", "\\d{2}");

  momentFormat = momentFormat.replace("MMMM", "\\w{1,}");
  momentFormat = momentFormat.replace("MMM", "\\w{3}");
  momentFormat = momentFormat.replace("MM", "\\d{2}");

  momentFormat = momentFormat.replace("DDDD", "\\d{3}");
  momentFormat = momentFormat.replace("DDD", "\\d{1,3}");
  momentFormat = momentFormat.replace("DD", "\\d{2}");
  momentFormat = momentFormat.replace("D", "\\d{1,2}");

  momentFormat = momentFormat.replace("ww", "\\d{1,2}");

  // Return actual RegExp instead of string (avoids eval)
  return new RegExp("^(" + momentFormat + ")$");
}

function getTasks(date) {
  var dateStr = normalizeDate(date) || moment(date).format("YYYY-MM-DD");
  
  // Get tasks from completion date index
  var completionTasks = taskIndex.byCompletionDate.get(dateStr) || [];
  done = completionTasks.filter((t) => t._calendarStatus === "done");
  
  // Get done tasks without completion date (by due date)
  var dueDateTasks = taskIndex.byDueDate.get(dateStr) || [];
  doneWithoutCompletionDate = dueDateTasks.filter(
    (t) => t._calendarStatus === "done" && !t._completionDate,
  );
  done = done.concat(doneWithoutCompletionDate);
  
  // Get due tasks (not completed, not recurring)
  due = dueDateTasks.filter(
    (t) => t._calendarStatus === "active" && !t.recurrence,
  );
  
  // Get recurring tasks
  recurrence = dueDateTasks.filter(
    (t) => t._calendarStatus === "active" && t.recurrence,
  );
  
  // Get overdue tasks - use pre-computed list for today, otherwise compute
  if (dateStr === tToday) {
    overdue = taskIndex.overdueToday;
  } else {
    overdue = [];
  }
  
  // Get start tasks from index
  var startDateTasks = taskIndex.byStartDate.get(dateStr) || [];
  start = startDateTasks.filter((t) => t._calendarStatus === "active");
  
  // Get scheduled tasks from index
  var scheduledDateTasks = taskIndex.byScheduledDate.get(dateStr) || [];
  scheduled = scheduledDateTasks.filter((t) => t._calendarStatus === "active");
  
  // Get process tasks (start before date, due after date)
  // Uses pre-filtered list of tasks with start dates (smaller subset)
  process = processIndex.get(dateStr) || [];
  
  // Get cancelled tasks
  cancelled = taskIndex.byCancelledDate.get(dateStr) || [];
  
  // Get daily note tasks from index
  var dailyNoteTasks = taskIndex.byDailyNote.get(dateStr) || [];
  dailyNote = dailyNoteTasks.filter((t) => t._calendarStatus === "active");
}

function setTask(obj, cls, types) {
  // types is an optional array of all types this task belongs to
  types = types || [cls];
  
  if (!obj._renderData) {
    var lighter = 25;
    var darker = -40;
    var noteColor = getMetaFromNote(obj, "color");
    var textColor = getMetaFromNote(obj, "textColor");
    var noteIcon = getMetaFromNote(obj, "icon");
    var taskText = obj.text.replace("'", "&apos;");
    var taskPath = obj.link.path.replace("'", "&apos;");
    var noteFilename = getFilename(taskPath);
    if (noteIcon) noteFilename = noteIcon + "&nbsp;" + noteFilename;
    var taskSubpath = obj.header.subpath;
    var taskLine = taskSubpath ? taskPath + "#" + taskSubpath : taskPath;
    var relative = obj.due ? moment(obj.due).fromNow() : "";

    if (noteColor && textColor) {
      var style = "--task-background:" + noteColor + "33;--task-color:" + noteColor + ";--dark-task-text-color:" + textColor + ";--light-task-text-color:" + textColor;
    } else if (noteColor) {
      var style = "--task-background:" + noteColor + "33;--task-color:" + noteColor + ";--dark-task-text-color:" + transColor(noteColor, darker) + ";--light-task-text-color:" + transColor(noteColor, lighter);
    } else if (textColor) {
      var style = "--task-background:#7D7D7D33;--task-color:#7D7D7D;--dark-task-text-color:" + transColor(textColor, darker) + ";--light-task-text-color:" + transColor(textColor, lighter);
    } else {
      var style = "--task-background:#7D7D7D33;--task-color:#7D7D7D;--dark-task-text-color:#171717;--light-task-text-color:#bdbdbd";
    }
    obj._renderData = { taskText, taskLine, noteFilename, noteIcon, relative, style };
  }
  var renderData = obj._renderData;
  
  // Combine icons if task has multiple types
  var taskIcon;
  if (types.length > 1) {
    taskIcon = types.map(function(t) { return taskIcons[t] || ""; }).join("");
  } else {
    taskIcon = taskIcons[cls] || "📅";
  }
  
  var noteFilename = renderData.noteFilename;
  if (!renderData.noteIcon) {
    noteFilename = taskIcon + "&nbsp;" + noteFilename;
    cls += " noNoteIcon";
  }
  var newTask = taskTemplate
    .replace("{{taskContent}}", renderData.taskText)
    .replace("{{class}}", cls)
    .replace("{{taskPath}}", renderData.taskLine)
    .replace("{{due}}", "done")
    .replaceAll("{{style}}", renderData.style)
    .replace("{{title}}", noteFilename + ": " + renderData.taskText)
    .replace("{{note}}", noteFilename)
    .replace("{{icon}}", taskIcon)
    .replace("{{relative}}", renderData.relative);
  return newTask;
}

function setTaskContentContainer(currentDate, includedTypes, excludedTaskKeys) {
  var cellContent = "";
  var includedTypeSet = includedTypes ? new Set(includedTypes) : null;

  function shouldRenderType(type) {
    return (!includedTypeSet || includedTypeSet.has(type)) &&
      (!hiddenTaskTypes[type] || !optionSet.has(hiddenTaskTypes[type]));
  }

  function compareFn(a, b) {
    if (a._sortPriority < b._sortPriority) {
      return -1;
    }
    if (a._sortPriority > b._sortPriority) {
      return 1;
    }
    if (a._sortPriority == b._sortPriority) {
      if (a._sortText < b._sortText) {
        return -1;
      }
      if (a._sortText > b._sortText) {
        return 1;
      }
      return 0;
    }
  }

  if (mergeTasks) {
    // MERGED MODE: Each task appears once with combined icons
    
    // Build a map of unique tasks with their combined types
    // Key: task path + line (unique identifier)
    var taskMap = new Map();
    
    // Priority order for the primary class (affects styling)
    function addTasksToMap(tasksToShow, type) {
      if (!shouldRenderType(type)) return;
      for (var t = 0; t < tasksToShow.length; t++) {
        var task = tasksToShow[t];
        // Use path + line position as unique key
        var taskKey = task.path + ":" + task.line;
        if (excludedTaskKeys && excludedTaskKeys.has(taskKey)) continue;
        
        if (taskMap.has(taskKey)) {
          // Task already exists, add this type to its list
          var entry = taskMap.get(taskKey);
          if (!entry.types.includes(type)) {
            entry.types.push(type);
          }
        } else {
          // New task, create entry
          taskMap.set(taskKey, {
            task: task,
            types: [type],
            primaryType: type  // First type encountered (highest priority)
          });
        }
      }
    }

    // Add tasks in priority order
    if (tToday == currentDate) {
      addTasksToMap(overdue, "overdue");
    }
    addTasksToMap(due, "due");
    addTasksToMap(recurrence, "recurrence");
    addTasksToMap(start, "start");
    addTasksToMap(scheduled, "scheduled");
    addTasksToMap(process, "process");
    addTasksToMap(dailyNote, "dailyNote");
    addTasksToMap(done, "done");
    addTasksToMap(cancelled, "cancelled");

    // Convert map to array and sort
    var uniqueTasks = Array.from(taskMap.values());
    
    // Sort by primary type priority, then by task priority/text
    uniqueTasks.sort((a, b) => {
      var aPriority = typeRank[a.primaryType];
      var bPriority = typeRank[b.primaryType];
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      return compareFn(a.task, b.task);
    });

    // Render each unique task with combined icons
    for (var i = 0; i < uniqueTasks.length; i++) {
      var entry = uniqueTasks[i];
      cellContent += setTask(entry.task, entry.primaryType, entry.types);
    }
  } else {
    // SEPARATE MODE: Tasks can appear multiple times (original behavior)
    
    function showTasks(tasksToShow, type) {
      if (!shouldRenderType(type)) return;
      var sorted = [...tasksToShow].sort(compareFn);
      for (var t = 0; t < sorted.length; t++) {
        var taskKey = sorted[t].path + ":" + sorted[t].line;
        if (excludedTaskKeys && excludedTaskKeys.has(taskKey)) continue;
        cellContent += setTask(sorted[t], type);
      }
    }

    if (tToday == currentDate) {
      showTasks(overdue, "overdue");
    }
    showTasks(due, "due");
    showTasks(recurrence, "recurrence");
    showTasks(start, "start");
    showTasks(scheduled, "scheduled");
    showTasks(process, "process");
    showTasks(dailyNote, "dailyNote");
    showTasks(done, "done");
    showTasks(cancelled, "cancelled");
  }
  
  return cellContent;
}

function setButtons() {
  var buttons =
    "<button class='filter'>" +
    filterIcon +
    "</button><button class='listView' title='List'>" +
    listIcon +
    "</button><button class='monthView' title='Month'>" +
    monthIcon +
    "</button><button class='weekView' title='Week'>" +
    weekIcon +
    "</button><button class='current'></button><button class='previous'>" +
    arrowLeftIcon +
    "</button><button class='next'>" +
    arrowRightIcon +
    "</button><button class='statistic' percentage=''></button>";
  rootNode
    .querySelector("span")
    .appendChild(dv.el("div", buttons, { cls: "buttons", attr: {} }));
  setButtonEvents();
}

function setButtonEvents() {
  rootNode.querySelectorAll("button").forEach((btn) =>
    btn.addEventListener("click", () => {
      var activeView = rootNode.getAttribute("view");
      if (btn.className == "previous") {
        if (activeView == "month") {
          selectedDate = moment(selectedDate).subtract(1, "months");
          getMonth(tasks, selectedDate);
        } else if (activeView == "week") {
          selectedDate = moment(selectedDate)
            .subtract(7, "days")
            .startOf("week");
          getWeek(tasks, selectedDate);
        } else if (activeView == "list") {
          selectedDate = moment(selectedDate).subtract(1, "months");
          getList(tasks, selectedDate);
        }
      } else if (btn.className == "current") {
        if (activeView == "month") {
          selectedDate = moment().date(1);
          getMonth(tasks, selectedDate);
        } else if (activeView == "week") {
          selectedDate = moment().startOf("week");
          getWeek(tasks, selectedDate);
        } else if (activeView == "list") {
          selectedDate = moment().date(1);
          getList(tasks, selectedDate);
        }
      } else if (btn.className == "next") {
        if (activeView == "month") {
          selectedDate = moment(selectedDate).add(1, "months");
          getMonth(tasks, selectedDate);
        } else if (activeView == "week") {
          selectedDate = moment(selectedDate).add(7, "days").startOf("week");
          getWeek(tasks, selectedDate);
        } else if (activeView == "list") {
          selectedDate = moment(selectedDate).add(1, "months");
          getList(tasks, selectedDate);
        }
      } else if (btn.className == "filter") {
        rootNode.classList.toggle("filter");
        rootNode.querySelector("#statisticDone").classList.remove("active");
        rootNode.classList.remove("focusDone");
      } else if (btn.className == "monthView") {
        if (
          moment().format("ww-YYYY") == moment(selectedDate).format("ww-YYYY")
        ) {
          selectedDate = moment().date(1);
        } else {
          selectedDate = moment(selectedDate).date(1);
        }
        getMonth(tasks, selectedDate);
      } else if (btn.className == "listView") {
        if (
          moment().format("ww-YYYY") == moment(selectedDate).format("ww-YYYY")
        ) {
          selectedDate = moment().date(1);
        } else {
          selectedDate = moment(selectedDate).date(1);
        }
        getList(tasks, selectedDate);
      } else if (btn.className == "weekView") {
        if (rootNode.getAttribute("view") == "week") {
          var leftPos = rootNode.querySelector("button.weekView").offsetLeft;
          rootNode.querySelector(".weekViewContext").style.left =
            leftPos + "px";
          rootNode.querySelector(".weekViewContext").classList.toggle("active");
          if (
            rootNode
              .querySelector(".weekViewContext")
              .classList.contains("active")
          ) {
            var closeContextListener = function () {
              rootNode
                .querySelector(".weekViewContext")
                .classList.remove("active");
              rootNode.removeEventListener(
                "click",
                closeContextListener,
                false,
              );
            };
            setTimeout(function () {
              rootNode.addEventListener("click", closeContextListener, false);
            }, 100);
          }
        } else {
          if (
            moment().format("MM-YYYY") != moment(selectedDate).format("MM-YYYY")
          ) {
            selectedDate = moment(selectedDate)
              .startOf("month")
              .startOf("week");
          } else {
            selectedDate = moment().startOf("week");
          }
          getWeek(tasks, selectedDate);
        }
      } else if (btn.className == "statistic") {
        rootNode.querySelector(".statisticPopup").classList.toggle("active");
      }
      btn.blur();
    }),
  );
  rootNode.addEventListener("contextmenu", function (event) {
    event.preventDefault();
  });
}

function setWrapperEvents() {
  rootNode.querySelectorAll(".wrapperButton").forEach((wBtn) =>
    wBtn.addEventListener("click", () => {
      var week = wBtn.getAttribute("data-week");
      var year = wBtn.getAttribute("data-year");
      selectedDate = moment(moment(year).add(week, "weeks")).startOf("week");
      rootNode.querySelector(`#tasksCalendar${tid} .grid`).remove();
      getWeek(tasks, selectedDate);
    }),
  );
}

function setStatisticPopUpEvents() {
  rootNode.querySelectorAll(".statisticPopup li").forEach((li) =>
    li.addEventListener("click", () => {
      var group = li.getAttribute("data-group");
      const liElements = rootNode.querySelectorAll(".statisticPopup li");
      if (li.classList.contains("active")) {
        const liElements = rootNode.querySelectorAll(".statisticPopup li");
        for (const liElement of liElements) {
          liElement.classList.remove("active");
        }
        rootNode.classList.remove("focus" + capitalize(group));
      } else {
        for (const liElement of liElements) {
          liElement.classList.remove("active");
        }
        li.classList.add("active");
        rootNode.classList.remove.apply(
          rootNode.classList,
          Array.from(rootNode.classList).filter((v) => v.startsWith("focus")),
        );
        rootNode.classList.add("focus" + capitalize(group));
      }
    }),
  );
}

function setStatisticPopUp() {
  var statistic = "<li id='statisticDone' data-group='done'></li>";
  statistic += "<li id='statisticDue' data-group='due'></li>";
  statistic += "<li id='statisticOverdue' data-group='overdue'></li>";
  statistic += "<li class='break'></li>";
  statistic += "<li id='statisticStart' data-group='start'></li>";
  statistic += "<li id='statisticScheduled' data-group='scheduled'></li>";
  statistic += "<li id='statisticRecurrence' data-group='recurrence'></li>";
  statistic += "<li class='break'></li>";
  statistic += "<li id='statisticDailyNote' data-group='dailyNote'></li>";
  rootNode
    .querySelector("span")
    .appendChild(dv.el("ul", statistic, { cls: "statisticPopup" }));
  setStatisticPopUpEvents();
}

function setWeekViewContextEvents() {
  rootNode.querySelectorAll(".weekViewContext li").forEach((li) =>
    li.addEventListener("click", () => {
      var selectedStyle = li.getAttribute("data-style");
      const liElements = rootNode.querySelectorAll(".weekViewContext li");
      if (!li.classList.contains("active")) {
        for (const liElement of liElements) {
          liElement.classList.remove("active");
        }
        li.classList.add("active");
        rootNode.classList.remove.apply(
          rootNode.classList,
          Array.from(rootNode.classList).filter((v) => v.startsWith("style")),
        );
        rootNode.classList.add(selectedStyle);
      }
      rootNode.querySelector(".weekViewContext").classList.toggle("active");
    }),
  );
}

function setWeekViewContext() {
  var activeStyle = Array.from(rootNode.classList).filter((v) =>
    v.startsWith("style"),
  );
  var liElements = "";
  var styles = 11;
  for (i = 1; i < styles + 1; i++) {
    var liIcon =
      "<div class='liIcon iconStyle" +
      i +
      "'><div class='box'></div><div class='box'></div><div class='box'></div><div class='box'></div><div class='box'></div><div class='box'></div><div class='box'></div></div>";
    liElements +=
      "<li data-style='style" + i + "'>" + liIcon + "Style " + i + "</li>";
  }
  rootNode
    .querySelector("span")
    .appendChild(dv.el("ul", liElements, { cls: "weekViewContext" }));
  rootNode
    .querySelector(".weekViewContext li[data-style=" + activeStyle + "]")
    .classList.add("active");
  setWeekViewContextEvents();
}

function setStatisticValues(
  dueCounter,
  doneCounter,
  overdueCounter,
  startCounter,
  scheduledCounter,
  recurrenceCounter,
  dailyNoteCounter,
) {
  var taskCounter = parseInt(dueCounter + doneCounter + overdueCounter);
  var tasksRemaining = taskCounter - doneCounter;
  var percentage = Math.round(
    (100 / (dueCounter + doneCounter + overdueCounter)) * doneCounter,
  );
  percentage = isNaN(percentage) ? 100 : percentage;

  if (dueCounter == 0 && doneCounter == 0) {
    rootNode.querySelector("button.statistic").innerHTML = calendarHeartIcon;
  } else if (tasksRemaining > 0) {
    rootNode.querySelector("button.statistic").innerHTML = calendarClockIcon;
  } else if (dueCounter == 0 && doneCounter != 0) {
    rootNode.querySelector("button.statistic").innerHTML = calendarCheckIcon;
  }
  if (tasksRemaining > 99) {
    tasksRemaining = "⚠️";
  }
  rootNode
    .querySelector("button.statistic")
    .setAttribute("data-percentage", percentage);
  rootNode
    .querySelector("button.statistic")
    .setAttribute("data-remaining", tasksRemaining);
  rootNode.querySelector("#statisticDone").innerText =
    "✅ Done: " + doneCounter + "/" + taskCounter;
  rootNode.querySelector("#statisticDue").innerText = "📅 Due: " + dueCounter;
  rootNode.querySelector("#statisticOverdue").innerText =
    "⚠️ Overdue: " + overdueCounter;
  rootNode.querySelector("#statisticStart").innerText =
    "🛫 Start: " + startCounter;
  rootNode.querySelector("#statisticScheduled").innerText =
    "⏳ Scheduled: " + scheduledCounter;
  rootNode.querySelector("#statisticRecurrence").innerText =
    "🔁 Recurrence: " + recurrenceCounter;
  rootNode.querySelector("#statisticDailyNote").innerText =
    "📄 Daily Notes: " + dailyNoteCounter;
}

function removeExistingView() {
  if (rootNode.querySelector(`#tasksCalendar${tid} .grid`)) {
    rootNode.querySelector(`#tasksCalendar${tid} .grid`).remove();
  } else if (rootNode.querySelector(`#tasksCalendar${tid} .list`)) {
    rootNode.querySelector(`#tasksCalendar${tid} .list`).remove();
  }
}

function getMonth(tasks, month) {
  removeExistingView();
  var monthBase = moment(month);
  var monthNumber = monthBase.format("MM");
  var monthYear = monthBase.format("YYYY");
  var currentTitle =
    "<span>" +
    monthBase.format("MMMM") +
    "</span><span> " +
    monthYear +
    "</span>";
  rootNode.querySelector("button.current").innerHTML = currentTitle;
  var gridContent = "";
  var firstDayOfMonth = monthBase.format("d");
  var lastDateOfMonth = monthBase.clone().endOf("month").date();
  var dueCounter = 0;
  var doneCounter = 0;
  var overdueCounter = 0;
  var startCounter = 0;
  var scheduledCounter = 0;
  var recurrenceCounter = 0;
  var dailyNoteCounter = 0;

  // Move First Week Of Month To Second Week In Month View
  if (firstDayOfMonth == 0) {
    firstDayOfMonth = 7;
  }

  // Set Grid Heads
  var gridHeads = "";
  for (
    h = 0 - firstDayOfMonth + parseInt(firstDayOfWeek);
    h < 7 - firstDayOfMonth + parseInt(firstDayOfWeek);
    h++
  ) {
    var headerDate = monthBase.clone().add(h, "days");
    var weekDayNr = headerDate.format("d");
    var weekDayName = headerDate.format("ddd");
    if (
      tDay == weekDayNr &&
      tMonth == monthBase.format("M") &&
      tYear == monthYear
    ) {
      gridHeads +=
        "<div class='gridHead today' data-weekday='" +
        weekDayNr +
        "'>" +
        weekDayName +
        "</div>";
    } else {
      gridHeads +=
        "<div class='gridHead' data-weekday='" +
        weekDayNr +
        "'>" +
        weekDayName +
        "</div>";
    }
  }

  // Set Wrappers
  var wrappers = "";
  var starts = 0 - firstDayOfMonth + parseInt(firstDayOfWeek);
  prepareProcessIndex(
    monthBase.clone().add(starts, "days").format("YYYY-MM-DD"),
    monthBase.clone().add(starts + 41, "days").format("YYYY-MM-DD"),
  );
  for (w = 1; w < 7; w++) {
    var wrapper = "";
    var weekNr = "";
    var yearNr = "";
    var monthName = monthBase.format("MMM")
      .replace(".", "")
      .substring(0, 3);
    for (i = starts; i < starts + 7; i++) {
      var cellDate = monthBase.clone().add(i, "days");
      if (i == starts) {
        weekNr = cellDate.format("w");
        yearNr = cellDate.format("YYYY");
      }
      var currentDate = cellDate.format("YYYY-MM-DD");
      if (!dailyNoteFolder) {
        var dailyNotePath = currentDate;
      } else {
        var dailyNotePath = dailyNoteFolder + "/" + currentDate;
      }
      var weekDay = cellDate.format("d");
      var shortDayName = cellDate.format("D");
      var longDayName = cellDate.format("D. MMM");

      // Filter Tasks
      getTasks(currentDate);

      // Count Events Only From Selected Month
      if (
        monthNumber == cellDate.format("MM")
      ) {
        dueCounter += due.length;
        dueCounter += recurrence.length;
        dueCounter += scheduled.length;
        dueCounter += dailyNote.length;
        doneCounter += done.length;
        startCounter += start.length;
        scheduledCounter += scheduled.length;
        recurrenceCounter += recurrence.length;
        dailyNoteCounter += dailyNote.length;
        // Get Overdue Count From Today
        if (
          tToday == currentDate
        ) {
          overdueCounter = overdue.length;
        }
      }

      // Set New Content Container
      var cellContent = setTaskContentContainer(currentDate);

      // Set Cell Name And Weekday
      if (cellDate.date() == 1) {
        var cell = cellTemplate
          .replace("{{date}}", currentDate)
          .replace("{{cellName}}", longDayName)
          .replace("{{cellContent}}", cellContent)
          .replace("{{weekday}}", weekDay)
          .replace("{{dailyNote}}", dailyNotePath);
        cell = cell.replace("{{class}}", "{{class}} newMonth");
      } else {
        var cell = cellTemplate
          .replace("{{date}}", currentDate)
          .replace("{{cellName}}", shortDayName)
          .replace("{{cellContent}}", cellContent)
          .replace("{{weekday}}", weekDay)
          .replace("{{dailyNote}}", dailyNotePath);
      }

      // Set prevMonth, currentMonth, nextMonth
      if (i < 0) {
        cell = cell.replace("{{class}}", "prevMonth");
      } else if (i >= 0 && i < lastDateOfMonth && tToday !== currentDate) {
        cell = cell.replace("{{class}}", "currentMonth");
      } else if (i >= 0 && i < lastDateOfMonth && tToday == currentDate) {
        cell = cell.replace("{{class}}", "currentMonth today");
      } else if (i >= lastDateOfMonth) {
        cell = cell.replace("{{class}}", "nextMonth");
      }
      wrapper += cell;
    }
    wrappers +=
      "<div class='wrapper'><div class='wrapperButton' data-week='" +
      weekNr +
      "' data-year='" +
      yearNr +
      "'>W" +
      weekNr +
      "</div>" +
      wrapper +
      "</div>";
    starts += 7;
  }
  gridContent +=
    "<div class='gridHeads'><div class='gridHead'></div>" +
    gridHeads +
    "</div>";
  gridContent +=
    "<div class='wrappers' data-month='" +
    monthName +
    "'>" +
    wrappers +
    "</div>";
  rootNode
    .querySelector("span")
    .appendChild(dv.el("div", gridContent, { cls: "grid" }));
  setWrapperEvents();
  setStatisticValues(
    dueCounter,
    doneCounter,
    overdueCounter,
    startCounter,
    scheduledCounter,
    recurrenceCounter,
    dailyNoteCounter,
  );
  rootNode.setAttribute("view", "month");
}

function getWeek(tasks, week) {
  removeExistingView();
  var weekBase = moment(week);
  var currentTitle =
    "<span>" +
    weekBase.format("YYYY") +
    "</span><span> " +
    weekBase.format("[W]w") +
    "</span>";
  rootNode.querySelector("button.current").innerHTML = currentTitle;
  var gridContent = "";
  var currentWeekday = weekBase.format("d");
  var weekNr = weekBase.format("[W]w");
  var dueCounter = 0;
  var doneCounter = 0;
  var overdueCounter = 0;
  var startCounter = 0;
  var scheduledCounter = 0;
  var recurrenceCounter = 0;
  var dailyNoteCounter = 0;

  var weekStartOffset = 0 - currentWeekday + parseInt(firstDayOfWeek);
  prepareProcessIndex(
    weekBase.clone().add(weekStartOffset, "days").format("YYYY-MM-DD"),
    weekBase.clone().add(weekStartOffset + 6, "days").format("YYYY-MM-DD"),
  );

  for (
    i = weekStartOffset;
    i < weekStartOffset + 7;
    i++
  ) {
    var cellDate = weekBase.clone().add(i, "days");
    var currentDate = cellDate.format("YYYY-MM-DD");
    if (!dailyNoteFolder) {
      var dailyNotePath = currentDate;
    } else {
      var dailyNotePath = dailyNoteFolder + "/" + currentDate;
    }
    var weekDay = cellDate.format("d");
    var dayName = cellDate.format("ddd D.");
    var longDayName = cellDate.format("ddd, D. MMM");

    // Filter Tasks
    getTasks(currentDate);

    // Count Events From Selected Week
    dueCounter += due.length;
    dueCounter += recurrence.length;
    dueCounter += scheduled.length;
    dueCounter += dailyNote.length;
    doneCounter += done.length;
    startCounter += start.length;
    scheduledCounter += scheduled.length;
    recurrenceCounter += recurrence.length;
    dailyNoteCounter += dailyNote.length;
    if (
      tToday == currentDate
    ) {
      overdueCounter = overdue.length;
    }

    // Set New Content Container
    var cellContent = setTaskContentContainer(currentDate);

    // Set Cell Name And Weekday
    var cell = cellTemplate
      .replace("{{date}}", currentDate)
      .replace("{{cellName}}", longDayName)
      .replace("{{cellContent}}", cellContent)
      .replace("{{weekday}}", weekDay)
      .replace("{{dailyNote}}", dailyNotePath);

    // Set Cell Name And Weekday
    if (cellDate.date() == 1) {
      var cell = cellTemplate
        .replace("{{date}}", currentDate)
        .replace("{{cellName}}", longDayName)
        .replace("{{cellContent}}", cellContent)
        .replace("{{weekday}}", weekDay)
        .replace("{{dailyNote}}", dailyNotePath);
    } else {
      var cell = cellTemplate
        .replace("{{date}}", currentDate)
        .replace("{{cellName}}", dayName)
        .replace("{{cellContent}}", cellContent)
        .replace("{{weekday}}", weekDay)
        .replace("{{dailyNote}}", dailyNotePath);
    }

    // Set Today, Before Today, After Today
    if (currentDate < tToday) {
      cell = cell.replace("{{class}}", "beforeToday");
    } else if (currentDate == tToday) {
      cell = cell.replace("{{class}}", "today");
    } else if (currentDate > tToday) {
      cell = cell.replace("{{class}}", "afterToday");
    }
    gridContent += cell;
  }
  rootNode
    .querySelector("span")
    .appendChild(
      dv.el("div", gridContent, { cls: "grid", attr: { "data-week": weekNr } }),
    );
  setStatisticValues(
    dueCounter,
    doneCounter,
    overdueCounter,
    startCounter,
    scheduledCounter,
    recurrenceCounter,
    dailyNoteCounter,
  );
  rootNode.setAttribute("view", "week");
}

function getList(tasks, month) {
  removeExistingView();
  var monthBase = moment(month).startOf("month");
  var selectedMonthKey = monthBase.format("YYYY-MM");
  var currentMonthKey = tToday.slice(0, 7);
  var currentTitle =
    "<span>" +
    monthBase.format("MMMM") +
    "</span><span> " +
    monthBase.format("YYYY") +
    "</span>";
  rootNode.querySelector("button.current").innerHTML = currentTitle;
  var listContent = "";
  var dueCounter = 0;
  var doneCounter = 0;
  var overdueCounter = 0;
  var startCounter = 0;
  var scheduledCounter = 0;
  var recurrenceCounter = 0;
  var dailyNoteCounter = 0;

  if (!upcomingDays) {
    upcomingDays = "7";
  }
  var listRangeStart = monthBase.format("YYYY-MM-DD");
  var listRangeEnd = monthBase.clone().endOf("month").format("YYYY-MM-DD");
  if (selectedMonthKey === currentMonthKey) {
    var upcomingRangeEnd = addIsoDays(tToday, parseInt(upcomingDays));
    if (upcomingRangeEnd > listRangeEnd) listRangeEnd = upcomingRangeEnd;
  }
  prepareProcessIndex(listRangeStart, listRangeEnd);
  var upcomingDates = new Set();
  var normalTypes = ["due", "recurrence", "start", "scheduled", "process", "dailyNote", "done", "cancelled"];

  // Loop Days From Current Month
  for (i = 0; i < monthBase.clone().endOf("month").date(); i++) {
    var listDate = monthBase.clone().add(i, "days");
    var currentDate = listDate.format("YYYY-MM-DD");
    var monthName = monthBase.format("MMM")
      .replace(".", "")
      .substring(0, 3);

    // Filter Tasks
    getTasks(currentDate);

    // Count Events
    dueCounter += due.length;
    dueCounter += recurrence.length;
    dueCounter += scheduled.length;
    dueCounter += dailyNote.length;
    doneCounter += done.length;
    startCounter += start.length;
    scheduledCounter += scheduled.length;
    recurrenceCounter += recurrence.length;
    dailyNoteCounter += dailyNote.length;
    if (tToday == currentDate) {
      overdueCounter = overdue.length;
      var overdueTaskKeys = new Set(
        overdue.map((task) => task.path + ":" + task.line),
      );
      var overdueDetails =
        "<details open class='overdue'><summary>Overdue</summary>" +
        setTaskContentContainer(currentDate, ["overdue"]) +
        "</details>";
      var todayDetails =
        "<details open class='today'><summary>Today</summary>" +
        setTaskContentContainer(currentDate, normalTypes, overdueTaskKeys) +
        "</details>";

      // Upcoming
      var upcomingContent = "";
      for (t = 1; t < parseInt(upcomingDays) + 1; t++) {
        var next = addIsoDays(currentDate, t);
        upcomingDates.add(next);
        getTasks(next);
        upcomingContent += setTaskContentContainer(next, normalTypes);
      }
      var upcomingDetails =
        "<details open class='upcoming'><summary>Upcoming</summary>" +
        upcomingContent +
        "</details>";

      listContent +=
        "<details open class='today'><summary><span>" +
        listDate.format("dddd, D") +
        "</span><span class='weekNr'> " +
        listDate.format("[W]w") +
        "</span></summary><div class='content'>" +
        overdueDetails +
        todayDetails +
        upcomingDetails +
        "</div></details>";
    } else if (!upcomingDates.has(currentDate)) {
      listContent +=
        "<details open><summary><span>" +
        listDate.format("dddd, D") +
        "</span><span class='weekNr'> " +
        listDate.format("[W]w") +
        "</span></summary><div class='content'>" +
        setTaskContentContainer(currentDate) +
        "</div></details>";
    }
  }
  rootNode
    .querySelector("span")
    .appendChild(
      dv.el("div", listContent, {
        cls: "list",
        attr: { "data-month": monthName },
      }),
    );
  setStatisticValues(
    dueCounter,
    doneCounter,
    overdueCounter,
    startCounter,
    scheduledCounter,
    recurrenceCounter,
    dailyNoteCounter,
  );
  rootNode.setAttribute("view", "list");

  // Scroll To Today If Selected Month Is Current Month
  if (currentMonthKey == selectedMonthKey) {
    var listElement = rootNode.querySelector(".list");
    var todayElement = rootNode.querySelector(".today");
    var scrollPos = todayElement.offsetTop - todayElement.offsetHeight + 85;
    listElement.scrollTo(0, scrollPos);
  }
}
