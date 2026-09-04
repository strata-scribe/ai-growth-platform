#!/bin/bash
sed -i 's/echo "changed_files<<EOF" >> $GITHUB_OUTPUT/echo "changed_files<<CHANGESEOF" >> $GITHUB_OUTPUT/' .github/workflows/bounty-validator.yml
sed -i 's/echo "EOF" >> $GITHUB_OUTPUT/echo "CHANGESEOF" >> $GITHUB_OUTPUT/' .github/workflows/bounty-validator.yml
