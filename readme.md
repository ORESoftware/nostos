# nostos

A command line utility to determine if any of your projects have uncommitted/unpushed code.
Useful when working on the same projects across different machines. What I used to do 
was check every repo three times and commit code way more than I needed to. Now I can just
run this tool at the root directory that contains all my projects before I shutdown or 
switch machines.


## installation

```bash
npm install -g nostos
```

## usage

### $ nostos

or with a directory argument

### $ nostos .

To force a commit and a push to the upstream repo/branch, you can use the force option

### $ nostos --force 

