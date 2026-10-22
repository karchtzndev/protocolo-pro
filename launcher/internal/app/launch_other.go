//go:build !windows

package app

import "os/exec"

// startGame abre o jogo e devolve uma funcao que espera ele fechar.
func startGame(exe, dir string, args []string) (func(), error) {
	cmd := exec.Command(exe, args...)
	cmd.Dir = dir
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	return func() { cmd.Wait() }, nil
}
