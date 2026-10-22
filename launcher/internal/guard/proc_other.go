//go:build !windows

package guard

// RunningProcesses so tem implementacao real no Windows.
func RunningProcesses() ([]string, error) { return nil, nil }
