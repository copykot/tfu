import { parse } from "kdljs";
import { exists } from "std/fs/exists";
import * as esbuild from "esbuild";
import { denoPlugins } from "@luca/esbuild-deno-loader";

const template_names = {
	"default": "default",
	"sender": "sender",
    "removal": "Removal from X",
    "punishment": "Notice of Punishment",
    "investigation": "Notice of Investigation",
    "activity": "Activity Warning",
    "ai": "Application Authenticity",
    "lets-talk": "Let's Talk",
    "warning": "First/Final Written Warning",
    "blacklist": "Notice of Blacklist",
};

const hidden = {
	"default": true,
	"sender": true
};

async function buildTemplates() {
    let templates = {}
    for (const [name, title] of Object.entries(template_names)) {
        const schema = parse(await Deno.readTextFile(`./templates/${name}/schema`))
        const content = await Deno.readTextFile(`./templates/${name}/content`)

        templates[title] = {
            content: content,
            schema: schema,
			hidden: hidden[name],
        };
    }

    await Deno.writeTextFile("./docs/templates.json", JSON.stringify(templates, null, 4));
}

async function build() {
    await Deno.mkdir("./docs/", { recursive: true });

    await buildTemplates();

    await Deno.copyFile("./index.css", "./docs/index.css");
    await Deno.copyFile("./index.html", "./docs/index.html");

    const b = await esbuild.build({
        plugins: [...denoPlugins()],
        entryPoints: ["./index.jsx"],
        outfile: "./docs/index.js",
        bundle: true,
        format: "esm",
        jsx: "automatic",
    });

    esbuild.stop();
}

await build();


if (Deno.args.includes("--watch")) {
    const watcher = Deno.watchFs(["./templates", "./index.jsx", "./index.html", "./index.css"])

    let timer = null;
    for await (const event of watcher) {
        clearTimeout(timer);

        timer = setTimeout(async () => {
            console.log("Rebuilding")

            await build();
        }, 100);
    }
}

