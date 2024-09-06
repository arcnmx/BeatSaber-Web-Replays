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
          npm install
          rm -rf node_modules/webpack{,-cli,-dev-server}
          ln -sT ${nodePackages_latest.webpack}/lib/node_modules/webpack node_modules/webpack
        '';
        npmserve = writeShellScriptBin "npmserve" ''
          set -eu
          export NODE_ENV=development
          exec webpack-cli serve "$@"
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
          npmserve
          webpack
          webpack-dev-server
          webpack-cli
          dat2bsor
          sspayload
          netlify-cli
          deno
        ];
        propagatedBuildInputs = with nodePackages_latest; [
          webpack
          #webpack-dev-server
        ];
        NODE_ENV = "production";
        shellHook = ''
          export NODE_PATH=''${NODE_PATH-${toString ./.}}
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
