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
      default = { mkShell, writeShellScriptBin, nodePackages_latest, netlify-cli, deno, xz }: let
        npminstall = writeShellScriptBin "npminstall" ''
          set -eu
          npm install --include=dev "$@"
        '';
        netserve = writeShellScriptBin "netserve" ''
          set -eu
          exec netlify dev "$@"
        '';
        dat2bsor = writeShellScriptBin "dat2bsor" ''
          exec node ./bin/dat2bsor.js "$@"
        '';
        sspayload = writeShellScriptBin "sspayload" ''
          set -eu
          DAT_PATH=$1
          shift
          tail -c +29 "$DAT_PATH" | ${xz}/bin/lzcat
        '';
      in mkShell {
        nativeBuildInputs = with nodePackages_latest; [
          nodejs
          npm
          npminstall
          netserve
          dat2bsor
          sspayload
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
