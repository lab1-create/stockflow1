const { execFile } = require("child_process");

execFile(
  "cmd.exe",
  ["/c", "for /f \"tokens=5\" %a in ('netstat -ano ^| findstr :4173') do taskkill /PID %a /F"],
  { windowsHide: true }
);
