//go:build !windows

package main

import "fmt"

func main() { fmt.Println("O launcher so roda no Windows. Compile com GOOS=windows.") }
