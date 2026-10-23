//go:build windows

package main

import (
	"image"
	"unsafe"

	"github.com/lxn/win"
	"golang.org/x/sys/windows"
)

var procSetClassLongPtr = windows.NewLazySystemDLL("user32.dll").NewProc("SetClassLongPtrW")

const gclpHCursor = ^uintptr(11) // -12

// newCursor cria um cursor colorido (com transparencia) a partir de uma imagem RGBA.
func newCursor(img *image.RGBA, hotX, hotY int) win.HCURSOR {
	w, h := img.Bounds().Dx(), img.Bounds().Dy()
	var bi win.BITMAPINFO
	bi.BmiHeader = win.BITMAPINFOHEADER{
		BiSize: uint32(unsafe.Sizeof(win.BITMAPINFOHEADER{})), BiWidth: int32(w), BiHeight: -int32(h),
		BiPlanes: 1, BiBitCount: 32, BiCompression: win.BI_RGB,
	}
	dc := win.GetDC(0)
	defer win.ReleaseDC(0, dc)
	var bits unsafe.Pointer
	color := win.CreateDIBSection(dc, &bi.BmiHeader, win.DIB_RGB_COLORS, &bits, 0, 0)
	if color == 0 || bits == nil {
		return 0
	}
	dst := unsafe.Slice((*byte)(bits), w*h*4)
	for i := 0; i < w*h; i++ { // RGBA reto -> BGRA pre-multiplicado
		r, g, b, a := uint32(img.Pix[i*4]), uint32(img.Pix[i*4+1]), uint32(img.Pix[i*4+2]), uint32(img.Pix[i*4+3])
		dst[i*4], dst[i*4+1], dst[i*4+2], dst[i*4+3] = uint8(b*a/255), uint8(g*a/255), uint8(r*a/255), uint8(a)
	}
	mask := win.CreateBitmap(int32(w), int32(h), 1, 1, nil)
	defer win.DeleteObject(win.HGDIOBJ(mask))
	defer win.DeleteObject(win.HGDIOBJ(color))
	ii := win.ICONINFO{FIcon: 0, XHotspot: uint32(hotX), YHotspot: uint32(hotY), HbmMask: mask, HbmColor: color}
	return win.HCURSOR(win.CreateIconIndirect(&ii))
}

// setWindowCursor troca o cursor padrao da classe da janela (vale enquanto o mouse esta nela).
func setWindowCursor(hwnd win.HWND, c win.HCURSOR) {
	if c != 0 {
		procSetClassLongPtr.Call(uintptr(hwnd), gclpHCursor, uintptr(c))
	}
}
