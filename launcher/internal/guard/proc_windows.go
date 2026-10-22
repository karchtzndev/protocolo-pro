//go:build windows

package guard

import (
	"unsafe"

	"golang.org/x/sys/windows"
)

// RunningProcesses lista os nomes dos executaveis em execucao.
func RunningProcesses() ([]string, error) {
	snap, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, 0)
	if err != nil {
		return nil, err
	}
	defer windows.CloseHandle(snap)
	var pe windows.ProcessEntry32
	pe.Size = uint32(unsafe.Sizeof(pe))
	var out []string
	for err = windows.Process32First(snap, &pe); err == nil; err = windows.Process32Next(snap, &pe) {
		out = append(out, windows.UTF16ToString(pe.ExeFile[:]))
	}
	return out, nil
}
