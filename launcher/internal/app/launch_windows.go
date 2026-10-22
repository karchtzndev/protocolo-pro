//go:build windows

package app

import (
	"fmt"
	"strings"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	shell32           = windows.NewLazySystemDLL("shell32.dll")
	procShellExecuteW = shell32.NewProc("ShellExecuteExW")
)

type shellExecuteInfo struct {
	cbSize       uint32
	fMask        uint32
	hwnd         uintptr
	lpVerb       *uint16
	lpFile       *uint16
	lpParameters *uint16
	lpDirectory  *uint16
	nShow        int32
	hInstApp     uintptr
	lpIDList     uintptr
	lpClass      *uint16
	hkeyClass    uintptr
	dwHotKey     uint32
	hIcon        uintptr
	hProcess     windows.Handle
}

const seeMaskNoCloseProcess = 0x00000040

// startGame abre o jogo pelo Shell do Windows. O l2.exe pede "executar como administrador" no
// proprio manifesto; CreateProcess (usado por os/exec) falha com "requer elevacao", ja o Shell
// mostra o aviso do Windows (UAC) e abre normalmente.
func startGame(exe, dir string, args []string) (func(), error) {
	file, err := windows.UTF16PtrFromString(exe)
	if err != nil {
		return nil, err
	}
	d, err := windows.UTF16PtrFromString(dir)
	if err != nil {
		return nil, err
	}
	var p *uint16
	if len(args) > 0 {
		if p, err = windows.UTF16PtrFromString(strings.Join(args, " ")); err != nil {
			return nil, err
		}
	}
	info := shellExecuteInfo{fMask: seeMaskNoCloseProcess, lpFile: file, lpParameters: p, lpDirectory: d, nShow: windows.SW_SHOWNORMAL}
	info.cbSize = uint32(unsafe.Sizeof(info))
	r, _, e := procShellExecuteW.Call(uintptr(unsafe.Pointer(&info)))
	if r == 0 {
		if e == syscall.Errno(1223) { // usuario recusou o UAC
			return nil, fmt.Errorf("o Windows pediu permissao de administrador e ela foi negada")
		}
		return nil, e
	}
	h := info.hProcess
	return func() {
		if h == 0 {
			return
		}
		windows.WaitForSingleObject(h, windows.INFINITE)
		windows.CloseHandle(h)
	}, nil
}
