package guard

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestMatch(t *testing.T) {
	p := filepath.Join(t.TempDir(), "b.txt")
	os.WriteFile(p, []byte("# c\nCheatEngine\nautoclicker*.exe\n\n"), 0o644)
	bl, err := LoadBlacklist(p)
	if err != nil {
		t.Fatal(err)
	}
	got := Match([]string{"explorer.exe", "cheatengine.exe", "AutoClicker3.exe", "cheatengine.exe"}, bl)
	if !reflect.DeepEqual(got, []string{"cheatengine", "autoclicker3"}) {
		t.Fatalf("got %v", got)
	}
}
