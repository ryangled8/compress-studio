// Exposes a small, safe API to the UI. The renderer has no direct Node access.
const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("api", {
  info:              ()                          => ipcRenderer.invoke("app:info"),
  presets:           ()                          => ipcRenderer.invoke("presets:get"),
  choose:            (type)                      => ipcRenderer.invoke("dialog:choose", type),
  collect:           (type, paths, subfolders)   => ipcRenderer.invoke("files:collect", type, paths, subfolders),
  thumbnail:         (filePath)                  => ipcRenderer.invoke("files:thumbnail", filePath),
  plan:              (type, preset, files, opts) => ipcRenderer.invoke("jobs:plan", type, preset, files, opts),
  start:             (type, preset, files, opts) => ipcRenderer.invoke("jobs:start", type, preset, files, opts),
  cancel:            ()                          => ipcRenderer.invoke("jobs:cancel"),
  reveal:            (target)                    => ipcRenderer.invoke("shell:reveal", target),
  existing:          (paths)                     => ipcRenderer.invoke("fs:existing", paths),
  openFilesPrivacy:  ()                          => ipcRenderer.invoke("shell:openFilesPrivacy"),
  pathForFile:       (file)                      => webUtils.getPathForFile(file),
  onJobEvent:        (fn) => ipcRenderer.on("jobs:event", (_e, event) => fn(event)),
});
