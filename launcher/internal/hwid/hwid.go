// Package hwid: ESTRUTURA DA FASE 2 (nao esta ligada ao launcher).
//
// Nao ha endpoint nem chave aqui. Quando o servidor definir o endpoint, basta
// implementar Reporter e ligar em cmd/launcher. Veja docs/FASE2-HWID.md.
package hwid

import (
	"crypto/sha256"
	"encoding/hex"
)

// Compute devolve SHA-256(salt || raw). Nunca envie o dado bruto (MAC, serial).
// O salt vem do servidor/configuracao e nao deve estar fixo no codigo.
func Compute(salt, raw string) string {
	h := sha256.Sum256([]byte(salt + "\x00" + raw))
	return hex.EncodeToString(h[:])
}

// Report e o que seria enviado por HTTPS: conta + token de sessao + identificador.
type Report struct {
	Account      string
	SessionToken string
	MachineID    string // saida de Compute
}

// Reporter envia o Report ao servidor. Nenhuma implementacao real existe ainda.
type Reporter interface {
	Send(Report) error
}

// Noop e o Reporter usado enquanto a Fase 2 nao for combinada.
type Noop struct{}

func (Noop) Send(Report) error { return nil }
