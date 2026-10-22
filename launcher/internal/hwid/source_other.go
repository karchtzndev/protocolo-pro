//go:build !windows

package hwid

import "errors"

func RawMachineSource() (string, error) { return "", errors.New("so no Windows") }
