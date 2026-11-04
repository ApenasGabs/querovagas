import app from "./app.ts";

const port = Number(process.env.PORT) || 3005;

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
