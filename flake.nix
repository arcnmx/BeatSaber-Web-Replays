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
          npm install "$@"
          rm -rf node_modules/webpack{,-cli,-dev-server}
          ln -sT ${nodePackages_latest.webpack}/lib/node_modules/webpack node_modules/webpack
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
          webpack
          webpack-dev-server
          webpack-cli
        ];
        propagatedBuildInputs = with nodePackages_latest; [
          webpack
          #webpack-dev-server
        ];
        NODE_ENV = "production";
        shellHook = ''
          export BSREPLAY_ROOT=''${BSREPLAY_ROOT-${toString ./.}}
          export NODE_PATH=''${NODE_PATH-$BSREPLAY_ROOT}
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
