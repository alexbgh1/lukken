# Photography

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.15.

## Development server

```
npm i
ng serve
```

## Deploy

```bash
# previous step
ng add angular-cli-ghpages

# creating branch
ng build --output-path=dist --base-href="/nebula-pix/"
git checkout -b gh-pages
ng build --output-path docs --base-href /nebula-pix/

# deploy
ng deploy
```
