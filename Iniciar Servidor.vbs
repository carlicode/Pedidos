Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")

' Obtener la ruta del script actual
scriptPath = fso.GetParentFolderName(WScript.ScriptFullName)

' Cambiar a la carpeta del proyecto (donde está el package.json)
WshShell.CurrentDirectory = scriptPath

' Ejecutar npm run dev:all sin mostrar ventana (0 = oculto)
WshShell.Run "cmd /c npm run dev:all", 0, False

Set WshShell = Nothing
Set fso = Nothing

