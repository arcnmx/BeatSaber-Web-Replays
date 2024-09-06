{
  inputs = {
    flakelib = {
      url = "github:flakelib/fl";
    };
    nixpkgs = { };
  };
  outputs = { self, nixpkgs, flakelib, ... }@inputs: let
    nixlib = nixpkgs.lib;
  in flakelib {
    inherit inputs;
    packages = let
    in {
    };
    legacyPackages = {
    };
    devShells = {
      default = { mkShell, writeShellScriptBin, nodePackages_latest, netlify-cli, deno }: let
        npminstall = writeShellScriptBin "npminstall" ''
          set -eu
          npm install --include=dev "$@"
        '';
        netserve = writeShellScriptBin "netserve" ''
          set -eu
          exec netlify dev "$@"
        '';
      in mkShell {
        nativeBuildInputs = with nodePackages_latest; [
          nodejs
          npm
          npminstall
          netserve
          netlify-cli
          deno
        ];
        NODE_ENV = "production";
        shellHook = ''
          export BSREPLAY_ROOT=''${BSREPLAY_ROOT-${toString ./.}}
          export NODE_PATH=''${NODE_PATH-$BSREPLAY_ROOT}
          export PATH="$BSREPLAY_ROOT/node_modules/.bin:$PATH"
        '';
      };
    };
    lib = {
      version = "0.2";
      src = nixlib.cleanSourceWith {
        name = "bsreplay-src-${self.lib.version}";
        src = ./.;
        filter = path: type: nixlib.hasSuffix ".yaml" path;
      };
    };
  };
}
