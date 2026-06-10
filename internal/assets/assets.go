// Package assets embeds the compiled React frontend.
// The web/dist directory is populated by running `npm run build` in web/.
package assets

import (
	"embed"
	"io/fs"
)

//go:embed web/dist
var embeddedFiles embed.FS

// FS returns the sub-filesystem rooted at web/dist.
func FS() (fs.FS, error) {
	return fs.Sub(embeddedFiles, "web/dist")
}
