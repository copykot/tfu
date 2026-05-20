import { parse } from "kdljs";
import { exists } from "std/fs/exists";
import * as esbuild from "esbuild";
import { denoPlugins } from "@luca/esbuild-deno-loader";

const template_names = {
    "removal": "Removal from X",
    "punishment": "Notice of Punishment",
    "investigation": "Notice of Investigation",
    "activity": "Activity Warning",
    "ai": "Application Authenticity",
    "lets-talk": "Let's Talk",
    "warning": "First/Final Written Warning",
    "blacklist": "Notice of Blacklist",
}

async function buildTemplates() {
    let templates = {}
    for (const [name, title] of Object.entries(template_names)) {
        const schema = parse(await Deno.readTextFile(`./templates/${name}/schema`))
        const content = await Deno.readTextFile(`./templates/${name}/content`)

        templates[title] = {
            content: content,
            schema: schema
        }
    }

    await Deno.writeTextFile("./build/templates.json", JSON.stringify(templates, null, 4));
}

async function build() {
    await Deno.mkdir("./build/", { recursive: true });

    await buildTemplates();

    await Deno.copyFile("./index.css", "./build/index.css");
    await Deno.copyFile("./index.html", "./build/index.html");

    const b = await esbuild.build({
        plugins: [...denoPlugins()],
        entryPoints: ["./index.jsx"],
        outfile: "./build/index.js",
        bundle: true,
        format: "esm",
        jsx: "automatic",
    });

    esbuild.stop();
}

await build();