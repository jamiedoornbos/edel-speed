run:
	npm run tauri dev

build:
	npm run tauri build

icons:
	npm run tauri icon

BUMP ?= patch

version:
	npm version $(BUMP) --no-git-tag-version
	cargo update --manifest-path src-tauri/Cargo.toml --workspace
