import { createRoot } from "react-dom/client";
import React from "react";
import Handlebars from "handlebars"
import { marked } from "marked";
import templates from "./docs/templates.json" with { type: "json" };

Handlebars.registerHelper("eq", function (arg1, arg2) {
    return arg1 === arg2;
});

Handlebars.registerHelper("neq", function (arg1, arg2) {
    return arg1 !== arg2;
});

Handlebars.registerHelper("and", function (...args) {
    return args.slice(0, -1).every(Boolean);
});

Handlebars.registerHelper("nand", function (...args) {
    return !args.slice(0, -1).every(Boolean);
});

Handlebars.registerHelper("or", function (...args) {
    return args.slice(0, -1).some(Boolean);
});

Handlebars.registerHelper("concat", function () {
    return Array.from(arguments).slice(0, -1).join("");
});

Handlebars.registerPartial("header", `
<p style="text-align: center;">
<img src="https://plpd.online/images/swat.png" style="display: block; margin: 0 auto;" width="164" height="164"/><br/>
<b>{{title}}</b><br/>
<b>{{department}}</b>
</p>
`)

function SenderField({ node, formData, onChange, people }) {
    const name = node.values[0];
    const label = node.properties.label || name;
    const selectedHandle = formData[name] || "";
    const person = selectedHandle ? people[selectedHandle] : null;

    function handleChange(e) {
        const handle = e.target.value
        onChange(name, handle)

        if (handle && people[handle]) {
            onChange("sender_rank", people[handle].rank)
            onChange("sender_name", people[handle].rp)
            onChange("sender_role", people[handle].role)
        } else {
            onChange("sender_rank", "")
            onChange("sender_name", "")
            onChange("sender_role", "")
        }
    }

    return (
        <div className="field-container">
            <label>{label}</label>
            <select name={name} value={selectedHandle} onChange={handleChange}>
                <option value="">-- Select a person --</option>
                {Object.values(people).map(p => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                ))}
            </select>
        </div>
    )
}

function Field({ node, formData, onChange, people, employees }) {
    const name = node.values[0];

	let changeFunction = (e) => { onChange(name, e.target.value) };
	if (node.properties.badge === "yes") {
		changeFunction = (e) => {
			const value = e.target.value;
			onChange(name, value);

			const badge = Number(value);
			for (const e of employees) {
				if (e.badgeNumber === badge || e.communityId === value) {
					onChange("officer_name", `${e.nick}`);
					onChange("recipient_rank", `${e.displayName}`);
					onChange("recipient_rp", `${e.rpName}`);

					break;
				}
			}
		}
	}

    if (node.properties.sender === "yes") {
        return <SenderField node={node} formData={formData} onChange={onChange} people={people}/>;
    }

    if (node.children.length > 0) {
        return (
            <div className="field-container">
                <label>{node.properties.label || name}</label>
                <select
                    name={name}
                    value={formData[name] || ""}
                    onChange={e => onChange(name, e.target.value)}
                >
                    <option value="">-- Select an option --</option>
                    {node.children.map(v => (
                        <option key={v.name} value={v.name}>{v.name}</option>
                    ))}
                </select>
            </div>
        );
    }

    if (node.properties.multiline === "yes") {
        return (
            <div className="field-container">
                <label>{node.properties.label || name}</label>
                <textarea id="input-text"
                    name={name}
                    value={formData[name] || ""}
                    onChange={e => onChange(name, e.target.value)}
                />
            </div>
        );
    } else {
        return (
            <div className="field-container">
                <label>{node.properties.label || name}</label>
                <input
                    type="text"
                    name={name}
                    value={formData[name] || ""}
                    onChange={changeFunction}
                />
            </div>
        );
    }
}


function RenderNode({ node, formData, onChange, people, employees }) {
	if (node.name === "inherit") {
		const templateName = node.values[0];

		if (templates[templateName]) {
			const template = templates[templateName].schema;

			return template.output.map((child, i) => (
				<RenderNode
					key={i}
					node={child}
					formData={formData}
					onChange={onChange}
					people={people}
					employees={employees}
				/>
			));
		}

		return null;
	}

    if (node.name === "field") {
        return <Field node={node} formData={formData} onChange={onChange} people={people} employees={employees}/>;
    }

    if (node.name === "showIf") {
        const shouldShow = Object.entries(node.properties || {}).every(
            ([k, v]) => formData[k] === v
        );

        if (!shouldShow) return null;

        return node.children.map((child, i) => (
            <RenderNode
                key={i}
                node={child}
                formData={formData}
                onChange={onChange}
                people={people}
				employees={employees}
            />
        ));
    }

    return null;
}

function usePeople() {
    const [people, setPeople] = React.useState({});

    React.useEffect(() => {
        async function load() {
            const res = await fetch("https://api.a1larsen.de/api/v2/tfu/hierarchy");
            const data = await res.json();

            setPeople(Object.fromEntries(
                data.map(p => [p.nick, {
                    name: p.nick,
                    rp: p.rpName,
                    rank: p.displayName,
                    role: p.role
                }])
            ));
        }

        load();
    }, []);

    return people;
}

function useEmployees() {
	const [employees, setEmployees] = React.useState({});

	React.useEffect(() => {
		async function load() {
			const res = await fetch("https://api.a1larsen.de/api/employees");
			const data = await res.json();

			setEmployees(data);
		}

		load();
	}, []);

	return employees;
}

function App() {
	const keys = Object.keys(templates).filter((e) => {
		return !templates[e].hidden;
	});

    const [formData, setFormData] = React.useState({});
    const [selectedTemplate, setSelectedTemplate] = React.useState(keys[0]);
    const schema = React.useMemo(() => templates[selectedTemplate].schema, [selectedTemplate]);
    const formIsFilled = React.useMemo(() => {
        const requiredFields = [];
        function findRequiredFields(node) {
			if (node.properties.required === "no") {
				return;
			}

            if (node.name === "field") {
                requiredFields.push(node.values[0]);
            } else if (node.name === "showIf") {
                const shouldShow = Object.entries(node.properties || {}).every(
                    ([k, v]) => formData[k] === v
                );

                if (shouldShow)
                    node.children.forEach(findRequiredFields);
            }
        }
        schema.output.forEach(findRequiredFields);
        return requiredFields.every(field => formData[field]);
    }, [schema, formData]);

    const people = usePeople();
    const employees = useEmployees();

    const renderedOutput = React.useMemo(() => {
        const template = Handlebars.compile(templates[selectedTemplate].content);
        const rendered = template(formData, { noEscape: true });
        const out = marked.parse(rendered);

        return {
            html: '<meta http-equiv="content-type" content="text/html; charset=utf-8">' + out,
            md: rendered
        }
    }, [formData, selectedTemplate, formIsFilled]);


    function onChange(name, value) {
        setFormData(prev => ({ ...prev, [name]: value }));
    }

    async function copyRichText() {
        if (!navigator.clipboard) {
            alert("Clipboard API not supported");
            return;
        }

        try {
            await navigator.clipboard.write([
                new ClipboardItem({
                    "text/html": new Blob([renderedOutput.html], { type: "text/html" }),
                    "text/plain": new Blob([renderedOutput.md], { type: "text/plain" })
                })
            ]);
            alert("Rendered output copied to clipboard!");
        } catch (err) {
            console.error("Failed to copy: ", err);
            alert("Failed to copy rendered output.");
        }
    }

    return (
        // schema selector, then form, then rendered output
        <div id="app-container">
            <div id="app-header">
                <div id="template-selector">
                    <label htmlFor="template-select">Select template:</label>
                    <select
                        id="template-select"
                        value={selectedTemplate}
                        onChange={e => setSelectedTemplate(e.target.value)}
                    >
                        {keys.map(templateName => (
                            <option key={templateName} value={templateName}>
                                {templateName}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <div id="app-body">
                <div id="form-container">
                    {formIsFilled && <h2>Form</h2> || <h2 style={{ color: "red" }}>Form is not entirely filled</h2>}

                    {schema.output.map((node, i) => (
                        <RenderNode
                            key={i}
                            node={node}
                            formData={formData}
                            onChange={onChange}
                            people={people}
							employees={employees || {}}
                        />
                    ))}
                </div>

                <div id="output-container">
                    <div id="buttons-container">
                        <button onClick={copyRichText}>
                            Copy Rendered Output
                        </button>
                    </div>
                    <div id="rendered-output">
                        <div dangerouslySetInnerHTML={{ __html: renderedOutput.html }} />
                    </div>
                </div>
            </div>
        </div>
    );
}


createRoot(document.getElementById("react-body")).render(<App/>);
