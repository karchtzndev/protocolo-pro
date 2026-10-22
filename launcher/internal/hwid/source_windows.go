//go:build windows

package hwid

import "golang.org/x/sys/windows/registry"

// RawMachineSource le o MachineGuid do Windows (dado estavel; fica so em memoria).
func RawMachineSource() (string, error) {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, `SOFTWARE\Microsoft\Cryptography`, registry.QUERY_VALUE|registry.WOW64_64KEY)
	if err != nil {
		return "", err
	}
	defer k.Close()
	v, _, err := k.GetStringValue("MachineGuid")
	return v, err
}
