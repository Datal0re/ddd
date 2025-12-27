#!/bin/zsh

# Define variables
output_file="./logs/help_test_output.txt"
ddd_commands=("dump" "hoard" "rummage" "upcycle" "burn")

echo "=========== TESTING HELP COMMANDS ===========\n" > $output_file

# Test help commands for each ddd command
for command in "${ddd_commands[@]}"; do
    echo "Testing output of 'ddd help $command'... "

    echo "\n------------------------------------------" >> $output_file
    echo "Testing output of 'ddd help $command'... " >> $output_file
    echo "------------------------------------------\n" >> $output_file
    ddd help $command &>> $output_file
done
echo "Help commands test complete. Results saved to $output_file. \n"

# Test complete, show results in console
echo "================ TEST RESULTS ================\n"
cat $output_file
